import {
  ATTACH_DIRS, B, IS_OPAQUE, IS_SOLID, doorBlock, doorState, isButton, isDoor, isLever, isLitRedstoneTorch, isPlate, isRedstoneTorch, isWire,
  redstoneTorchLit, supportDir, switchFace, switchOn, wireBlock, wirePower,
} from "./blocks";

/**
 * Redstone, simplified from the classic rules:
 *  - Sources (15): a lever or button that is on, a pressed plate, a lit redstone torch.
 *  - Dust takes the strongest neighbouring signal minus one: from dust beside
 *    it (also one step up or down a block edge), or 15 straight from a source
 *    or a strongly powered block next to it.
 *  - Blocks: strongly powered by a switch hanging on them, a plate on top of
 *    them or a lit torch under them; weakly powered by dust on or beside them.
 *  - A redstone torch is lit unless the block it stands or hangs on is powered
 *    (that's the inverter). It reacts one tick late, so torch loops blink rather than hang.
 *  - Doors open while powered. Iron doors only respond to redstone; wooden
 *    doors follow redstone when the signal changes and can also be opened by hand.
 */

export interface BlockGetter {
  getBlock(x: number, y: number, z: number): number;
}

const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** Signal a block emits on its own. */
export function sourcePower(id: number): number {
  if (isLitRedstoneTorch(id) || id === B.PRESSURE_PLATE_ON) return 15;
  if ((isLever(id) || isButton(id)) && switchOn(id)) return 15;
  return 0;
}

const isConductor = (id: number) => IS_OPAQUE[id] === 1 && IS_SOLID[id] === 1;

/** Strong power: a switch attached to this block, a pressed plate on top, or a lit torch underneath. */
export function stronglyPowered(w: BlockGetter, x: number, y: number, z: number): boolean {
  if (!isConductor(w.getBlock(x, y, z))) return false;
  for (const [dx, dy, dz] of N6) {
    const id = w.getBlock(x + dx, y + dy, z + dz);
    if ((isLever(id) || isButton(id)) && switchOn(id)) {
      const [ax, ay, az] = ATTACH_DIRS[switchFace(id)];
      if (dx + ax === 0 && dy + ay === 0 && dz + az === 0) return true;
    }
    if (dy === 1 && id === B.PRESSURE_PLATE_ON) return true;
    if (dy === -1 && isLitRedstoneTorch(id)) return true;
  }
  return false;
}

/** Strong power, or weak power from active dust on top of or beside the block. */
export function blockPowered(w: BlockGetter, x: number, y: number, z: number): boolean {
  if (!isConductor(w.getBlock(x, y, z))) return false;
  if (stronglyPowered(w, x, y, z)) return true;
  if (wirePower(w.getBlock(x, y + 1, z)) > 0) return true;
  for (const [dx, dz] of N4) if (wirePower(w.getBlock(x + dx, y, z + dz)) > 0) return true;
  return false;
}

/** The power level dust at (x,y,z) should have. */
export function wireTarget(w: BlockGetter, x: number, y: number, z: number): number {
  let best = 0;
  for (const [dx, dy, dz] of N6) {
    const id = w.getBlock(x + dx, y + dy, z + dz);
    if (sourcePower(id) > 0) return 15;
    if (isConductor(id) && stronglyPowered(w, x + dx, y + dy, z + dz)) return 15;
  }
  const upOpen = !IS_OPAQUE[w.getBlock(x, y + 1, z)];
  for (const [dx, dz] of N4) {
    const side = w.getBlock(x + dx, y, z + dz);
    best = Math.max(best, wirePower(side) - 1);
    // Dust climbing a block edge, or stepping down off one.
    if (upOpen && IS_OPAQUE[side]) best = Math.max(best, wirePower(w.getBlock(x + dx, y + 1, z + dz)) - 1);
    if (!IS_OPAQUE[side]) best = Math.max(best, wirePower(w.getBlock(x + dx, y - 1, z + dz)) - 1);
  }
  return Math.max(0, best);
}

/** Is any signal reaching a cell (for doors): a source, live dust, or a powered block next to it. */
export function cellReceivesPower(w: BlockGetter, x: number, y: number, z: number): boolean {
  for (const [dx, dy, dz] of N6) {
    const id = w.getBlock(x + dx, y + dy, z + dz);
    if (sourcePower(id) > 0 || wirePower(id) > 0) return true;
    if (blockPowered(w, x + dx, y + dy, z + dz)) return true;
  }
  return false;
}

/** A redstone torch stays lit unless the block it stands or hangs on is powered. */
export function torchShouldBeLit(w: BlockGetter, x: number, y: number, z: number) {
  const [dx, dy, dz] = supportDir(w.getBlock(x, y, z)) ?? [0, -1, 0];
  return !blockPowered(w, x + dx, y + dy, z + dz);
}

/** Which way dust is drawn: along X, along Z, or a cross. */
export function wireShape(w: BlockGetter, x: number, y: number, z: number): "x" | "z" | "cross" {
  const connects = (dx: number, dz: number) => {
    const id = w.getBlock(x + dx, y, z + dz);
    if (isWire(id) || sourcePower(id) > 0 || isRedstoneTorch(id) || isLever(id) || isButton(id) || isPlate(id) || isDoor(id)) return true;
    if (isWire(w.getBlock(x + dx, y - 1, z + dz)) && !IS_OPAQUE[id]) return true;
    return !IS_OPAQUE[w.getBlock(x, y + 1, z)] && isWire(w.getBlock(x + dx, y + 1, z + dz));
  };
  const ex = connects(1, 0) || connects(-1, 0);
  const ez = connects(0, 1) || connects(0, -1);
  if (ex && !ez) return "x";
  if (ez && !ex) return "z";
  return "cross";
}

export interface RedstoneWorld extends BlockGetter {
  setBlock(x: number, y: number, z: number, id: number): boolean;
}

const pack = (x: number, y: number, z: number) => `${x},${y},${z}`;

/**
 * Event-driven redstone. Changes near a component queue it; each tick settles
 * all dust immediately (dust has no delay) and schedules torch flips for the
 * next tick.
 */
export class RedstoneSim {
  private queue = new Map<string, [number, number, number]>();
  /** Torch flips and button releases, by game time. */
  private scheduled = new Map<string, { at: number; run: () => void }>();
  /** Last redstone signal seen by each door (wooden doors only follow changes). */
  private doorPower = new Map<string, boolean>();
  private time = 0;

  constructor(private world: RedstoneWorld, private budget = 4096) {}

  get pending() {
    return this.queue.size + this.scheduled.size;
  }

  notify(x: number, y: number, z: number) {
    for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy;
      if (yy < 0 || yy >= 128) continue;
      const k = pack(x + dx, yy, z + dz);
      if (!this.queue.has(k)) this.queue.set(k, [x + dx, yy, z + dz]);
    }
    // Doors and torches react to the block two away being powered too.
    for (const [dx, dy, dz] of N6) {
      const k = pack(x + dx * 2, y + dy * 2, z + dz * 2);
      if (!this.queue.has(k)) this.queue.set(k, [x + dx * 2, y + dy * 2, z + dz * 2]);
    }
  }

  /** Runs `run` after `delay` seconds of game time (replacing any pending action for `key`). */
  schedule(key: string, delay: number, run: () => void) {
    this.scheduled.set(key, { at: this.time + delay, run });
  }

  tick(dt: number) {
    this.time += dt;
    for (const [k, s] of [...this.scheduled]) {
      if (s.at <= this.time) {
        this.scheduled.delete(k);
        s.run();
      }
    }
    let ops = 0;
    while (this.queue.size && ops++ < this.budget) {
      const [k, [x, y, z]] = this.queue.entries().next().value!;
      this.queue.delete(k);
      this.update(x, y, z);
    }
  }

  private update(x: number, y: number, z: number) {
    const w = this.world;
    const id = w.getBlock(x, y, z);
    if (isWire(id)) {
      const target = wireTarget(w, x, y, z);
      const now = wirePower(id);
      // Weakening dust first goes dark, so neighbouring dust can't keep
      // feeding each other; the neighbours it wakes then rebuild the signal
      // from whatever sources are left.
      if (target < now) w.setBlock(x, y, z, wireBlock(0));
      else if (target > now) w.setBlock(x, y, z, wireBlock(target));
      return;
    }
    if (isRedstoneTorch(id)) {
      const lit = torchShouldBeLit(w, x, y, z);
      if (lit !== isLitRedstoneTorch(id)) {
        this.schedule(`torch:${x},${y},${z}`, 0.1, () => {
          const now = w.getBlock(x, y, z);
          if (!isRedstoneTorch(now)) return;
          const want = torchShouldBeLit(w, x, y, z);
          w.setBlock(x, y, z, redstoneTorchLit(now, want));
        });
      }
      return;
    }
    if (isDoor(id)) {
      const s = doorState(id);
      const by = s.upper ? y - 1 : y;
      const lower = w.getBlock(x, by, z);
      if (!isDoor(lower)) return;
      const powered = cellReceivesPower(w, x, by, z) || cellReceivesPower(w, x, by + 1, z);
      const key = pack(x, by, z);
      const before = this.doorPower.get(key);
      this.doorPower.set(key, powered);
      const ls = doorState(lower);
      // Iron doors always mirror the signal; wooden ones only when it changes.
      if (ls.iron ? powered !== ls.open : before !== undefined && before !== powered && powered !== ls.open) {
        setDoorOpen(w, x, by, z, powered);
      }
    }
  }

  clear() {
    this.queue.clear();
    this.scheduled.clear();
  }
}

/** Opens or closes both halves of the door whose lower half is at (x,y,z). */
export function setDoorOpen(w: RedstoneWorld, x: number, y: number, z: number, open: boolean) {
  const lower = w.getBlock(x, y, z);
  if (!isDoor(lower)) return;
  const s = doorState(lower);
  w.setBlock(x, y, z, doorBlock(s.iron, s.facing, open, false));
  if (isDoor(w.getBlock(x, y + 1, z))) w.setBlock(x, y + 1, z, doorBlock(s.iron, s.facing, open, true));
}

import { BLOCKS, B, FLOW_BLOCK, FLUID_LEVEL } from "./blocks";

/**
 * Water flow.
 *
 * Every water cell has a level: 4 = source (never changes on its own),
 * 3/2/1 = flowing. A cell's *target* level comes from its feeders:
 *   - any water directly above            -> 3 (falling water)
 *   - a horizontal neighbour of level L   -> L - 1 (so a source gives 3,
 *     then 2, then 1, and level 1 feeds nothing)
 * A neighbour only feeds sideways when it rests on something it cannot fall
 * into, so falling water drops first and spreads where it lands.
 * Cells rise to their target at once but recede one level per tick, which is
 * what makes a cut-off stream drain gradually.
 */

/** The 10 block ids around a cell that decide its next state. */
export interface FluidNeighbourhood {
  self: number;
  above: number;
  below: number;
  /** +X, -X, +Z, -Z */
  sides: [number, number, number, number];
  /** The block under each side neighbour, same order. */
  sidesBelow: [number, number, number, number];
}

/** Air, plants and torches get washed away by water; solid blocks stop it. */
export function isFlowable(id: number): boolean {
  if (id === B.AIR) return true;
  const def = BLOCKS[id];
  return !!def && !def.solid && FLUID_LEVEL[id] === 0 && (def.replaceable || def.needsSupport);
}

/** True if water standing on `below` spreads sideways instead of falling. */
export function restsOn(below: number): boolean {
  if (isFlowable(below)) return false;
  // Flowing water underneath can still be filled, so the cell above keeps falling.
  const level = FLUID_LEVEL[below];
  return level === 0 || level === 4;
}

/** Pure rule: the block id this cell should become on the next fluid tick. */
export function nextFluidState(n: FluidNeighbourhood): number {
  const selfLevel = FLUID_LEVEL[n.self];
  if (selfLevel === 4) return n.self;
  if (selfLevel === 0 && !isFlowable(n.self)) return n.self;

  let target = FLUID_LEVEL[n.above] > 0 ? 3 : 0;
  for (let i = 0; i < 4; i++) {
    const level = FLUID_LEVEL[n.sides[i]];
    if (level > 1 && restsOn(n.sidesBelow[i])) target = Math.max(target, Math.min(3, level - 1));
  }

  const next = target >= selfLevel ? target : selfLevel - 1;
  if (next === selfLevel) return n.self;
  if (next > 0) return FLOW_BLOCK[next];
  return selfLevel > 0 ? B.AIR : n.self;
}

export interface FluidWorld {
  getBlock(x: number, y: number, z: number): number;
  /** Returns false if the cell could not be changed (e.g. chunk not loaded). */
  setBlock(x: number, y: number, z: number, id: number): boolean;
  isLoaded(x: number, z: number): boolean;
}

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const pack = (x: number, y: number, z: number) => `${x},${y},${z}`;

/**
 * Event-driven simulator: only cells next to a change are ever examined.
 * `tick()` processes the cells queued before it started (newly woken cells
 * wait for the next tick), so water advances one cell per tick.
 */
export class FluidSimulator {
  private queue = new Map<string, [number, number, number]>();
  /** Called when water replaces a plant or torch, so it can drop as an item. */
  onWashedAway: ((x: number, y: number, z: number, id: number) => void) | null = null;

  constructor(private world: FluidWorld, private budget = 512) {}

  get pending() {
    return this.queue.size;
  }

  /** Wake a cell and its six neighbours after the block there changed. */
  notify(x: number, y: number, z: number) {
    this.enqueue(x, y, z);
    this.enqueue(x, y + 1, z);
    this.enqueue(x, y - 1, z);
    for (const [dx, dz] of SIDES) this.enqueue(x + dx, y, z + dz);
  }

  private enqueue(x: number, y: number, z: number) {
    if (y < 0 || y >= 128) return;
    const key = pack(x, y, z);
    if (!this.queue.has(key)) this.queue.set(key, [x, y, z]);
  }

  neighbourhood(x: number, y: number, z: number): FluidNeighbourhood {
    const w = this.world;
    const sides: [number, number, number, number] = [0, 0, 0, 0];
    const sidesBelow: [number, number, number, number] = [0, 0, 0, 0];
    SIDES.forEach(([dx, dz], i) => {
      sides[i] = w.getBlock(x + dx, y, z + dz);
      sidesBelow[i] = y > 0 ? w.getBlock(x + dx, y - 1, z + dz) : B.BEDROCK;
    });
    return {
      self: w.getBlock(x, y, z),
      above: y < 127 ? w.getBlock(x, y + 1, z) : B.AIR,
      below: y > 0 ? w.getBlock(x, y - 1, z) : B.BEDROCK,
      sides,
      sidesBelow,
    };
  }

  /** One fluid step; returns how many cells changed. */
  tick(): number {
    if (!this.queue.size) return 0;
    const batch: [number, number, number][] = [];
    for (const [key, cell] of this.queue) {
      batch.push(cell);
      this.queue.delete(key);
      if (batch.length >= this.budget) break;
    }
    // Decide everything from the same snapshot, then apply.
    const changes: [number, number, number, number, number][] = [];
    for (const [x, y, z] of batch) {
      if (!this.loadedAround(x, z)) continue;
      const n = this.neighbourhood(x, y, z);
      const next = nextFluidState(n);
      if (next !== n.self) changes.push([x, y, z, n.self, next]);
    }
    let changed = 0;
    for (const [x, y, z, before, next] of changes) {
      if (!this.world.setBlock(x, y, z, next)) continue;
      changed++;
      if (FLUID_LEVEL[before] === 0 && before !== B.AIR) this.onWashedAway?.(x, y, z, before);
      this.notify(x, y, z);
    }
    return changed;
  }

  private loadedAround(x: number, z: number) {
    const w = this.world;
    return w.isLoaded(x, z) && w.isLoaded(x + 1, z) && w.isLoaded(x - 1, z) && w.isLoaded(x, z + 1) && w.isLoaded(x, z - 1);
  }

  clear() {
    this.queue.clear();
  }
}

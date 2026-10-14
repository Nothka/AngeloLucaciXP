import { BLOCKS, B, FLUID_LEVEL, waterBlock } from "./blocks";

/**
 * Water flow, following the classic rules.
 *
 * Levels: 8 = source, 9 = falling, 7..1 = flowing. A cell's level comes from
 * its feeders:
 *   - water directly above            -> falling water (9)
 *   - a source or falling neighbour   -> 7, and one less per block after that,
 *     so a source reaches 7 blocks across flat ground
 *   - two or more source neighbours on a solid floor -> a new source
 * Water only spreads sideways when it rests on something it cannot fall
 * into. When there is a drop within 5 blocks, water heads only toward the
 * nearest one instead of spreading in every direction.
 */

export interface BlockGetter {
  getBlock(x: number, y: number, z: number): number;
}

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
/** How far water looks for a drop to flow toward. */
export const DROP_SEARCH = 5;

/** Air, plants, torches and redstone bits get washed away; solid blocks stop it. */
export function isFlowable(id: number): boolean {
  if (id === B.AIR) return true;
  const def = BLOCKS[id];
  return !!def && !def.solid && FLUID_LEVEL[id] === 0 && (def.replaceable || def.needsSupport);
}

/** True if water standing on `below` spreads sideways instead of falling. */
export function restsOn(below: number): boolean {
  if (isFlowable(below)) return false;
  const level = FLUID_LEVEL[below];
  // Flowing water underneath can still be filled, so the cell above keeps falling.
  return level === 0 || level === 8;
}

/** Water can move into this cell (empty, or weaker flowing water). */
const enterable = (id: number) => isFlowable(id) || (FLUID_LEVEL[id] > 0 && FLUID_LEVEL[id] < 8);

/** A cell water standing in it could pour down from. */
const hasDrop = (w: BlockGetter, x: number, y: number, z: number) => y > 0 && enterable(w.getBlock(x, y - 1, z)) && !isWaterBelowFull(w, x, y, z);
const isWaterBelowFull = (w: BlockGetter, x: number, y: number, z: number) => FLUID_LEVEL[w.getBlock(x, y - 1, z)] >= 8;

/**
 * Shortest walk (in blocks) from (x,y,z) to a drop, across enterable cells on
 * the same level, or Infinity if none within DROP_SEARCH.
 */
function distanceToDrop(w: BlockGetter, x: number, y: number, z: number, fromX: number, fromZ: number): number {
  if (hasDrop(w, x, y, z)) return 0;
  const seen = new Set<string>([`${fromX},${fromZ}`, `${x},${z}`]);
  let frontier: [number, number][] = [[x, z]];
  for (let d = 1; d < DROP_SEARCH; d++) {
    const next: [number, number][] = [];
    for (const [cx, cz] of frontier) {
      for (const [dx, dz] of SIDES) {
        const nx = cx + dx, nz = cz + dz;
        const k = `${nx},${nz}`;
        if (seen.has(k)) continue;
        seen.add(k);
        if (!enterable(w.getBlock(nx, y, nz))) continue;
        if (hasDrop(w, nx, y, nz)) return d;
        next.push([nx, nz]);
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return Infinity;
}

/**
 * Directions (indices into SIDES) a resting water cell pushes into: toward
 * the nearest drop when one is in range, otherwise every open side.
 */
export function flowDirections(w: BlockGetter, x: number, y: number, z: number): boolean[] {
  const dist = SIDES.map(([dx, dz]) => (enterable(w.getBlock(x + dx, y, z + dz)) ? distanceToDrop(w, x + dx, y, z + dz, x, z) : Infinity));
  const best = Math.min(...dist);
  if (best === Infinity) return SIDES.map(([dx, dz]) => enterable(w.getBlock(x + dx, y, z + dz)));
  return dist.map((d) => d === best);
}

/** Pure rule: the block id this cell should become on the next fluid tick. */
export function nextFluidState(w: BlockGetter, x: number, y: number, z: number): number {
  const self = w.getBlock(x, y, z);
  const selfLevel = FLUID_LEVEL[self];
  if (selfLevel === 8) return self;
  if (selfLevel === 0 && !isFlowable(self)) return self;

  const below = y > 0 ? w.getBlock(x, y - 1, z) : B.BEDROCK;
  let sources = 0;
  let target = FLUID_LEVEL[w.getBlock(x, y + 1, z)] > 0 ? 9 : 0;
  for (let i = 0; i < 4; i++) {
    const [dx, dz] = SIDES[i];
    const nx = x + dx, nz = z + dz;
    const n = w.getBlock(nx, y, nz);
    const level = FLUID_LEVEL[n];
    if (!level) continue;
    if (level === 8) sources++;
    if (level < 2 && level !== 0) continue;
    if (!restsOn(w.getBlock(nx, y - 1, nz))) continue;
    const give = level >= 8 ? 7 : level - 1;
    if (give <= target || target === 9) continue;
    // The neighbour must be flowing this way (toward its nearest drop, if any).
    const back = i ^ 1;
    if (!flowDirections(w, nx, y, nz)[back]) continue;
    target = give;
  }
  // Two sources side by side over a floor make a new, permanent one.
  if (sources >= 2 && restsOn(below)) target = 8;

  if (target === selfLevel) return self;
  if (target > 0) return waterBlock(target);
  return selfLevel > 0 ? B.AIR : self;
}

export interface FluidWorld extends BlockGetter {
  /** Returns false if the cell could not be changed (e.g. chunk not loaded). */
  setBlock(x: number, y: number, z: number, id: number): boolean;
  isLoaded(x: number, z: number): boolean;
}

const pack = (x: number, y: number, z: number) => `${x},${y},${z}`;

/**
 * Event-driven simulator: only cells near a change are ever examined.
 * `tick()` processes the cells queued before it started (newly woken cells
 * wait for the next tick), so water advances one block per tick.
 */
export class FluidSimulator {
  private queue = new Map<string, [number, number, number]>();
  /** Called when water replaces a plant or torch, so it can drop as an item. */
  onWashedAway: ((x: number, y: number, z: number, id: number) => void) | null = null;

  constructor(private world: FluidWorld, private budget = 512) {}

  get pending() {
    return this.queue.size;
  }

  /** Wake a cell and the cells around it after the block there changed. */
  notify(x: number, y: number, z: number) {
    this.enqueue(x, y, z);
    this.enqueue(x, y + 1, z);
    this.enqueue(x, y - 1, z);
    for (const [dx, dz] of SIDES) {
      this.enqueue(x + dx, y, z + dz);
      // Diagonal and two-away cells: their flow direction can depend on this one.
      this.enqueue(x + dx, y + 1, z + dz);
    }
  }

  private enqueue(x: number, y: number, z: number) {
    if (y < 0 || y >= 128) return;
    const key = pack(x, y, z);
    if (!this.queue.has(key)) this.queue.set(key, [x, y, z]);
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
      const before = this.world.getBlock(x, y, z);
      if (FLUID_LEVEL[before] === 0 && !isFlowable(before)) continue;
      const next = nextFluidState(this.world, x, y, z);
      if (next !== before) changes.push([x, y, z, before, next]);
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
    const r = DROP_SEARCH + 1;
    return w.isLoaded(x, z) && w.isLoaded(x + r, z) && w.isLoaded(x - r, z) && w.isLoaded(x, z + r) && w.isLoaded(x, z - r);
  }

  clear() {
    this.queue.clear();
  }
}

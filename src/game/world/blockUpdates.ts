import { BLOCKS, B, I, doorState, isDoor, supportDir, supports } from "./blocks";

export interface UpdateWorld {
  getBlock(x: number, y: number, z: number): number;
  setBlock(x: number, y: number, z: number, id: number): boolean;
}

export interface BlockUpdateHooks {
  /** A block popped off because what held it went away; drop `id`'s item here. */
  popped(x: number, y: number, z: number, id: number): void;
  /** Every change, after the rules above ran (fluids, redstone, gravity listen here). */
  changed(x: number, y: number, z: number, before: number, after: number): void;
}

const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;

/**
 * What a block change does to its neighbours: blocks hanging on the cell
 * pop off (torches, plants, dust, switches, crops, doors), and breaking
 * either half of a door takes the other with it. Changes made here go
 * through the same queue, so a chain (a door on a block on which a torch
 * hangs...) resolves without recursion.
 */
export class BlockUpdates {
  private queue: [number, number, number, number, number][] = [];
  private draining = false;

  constructor(private world: UpdateWorld, private hooks: BlockUpdateHooks) {}

  /** Wire to World.onBlockChange. */
  onChange(x: number, y: number, z: number, before: number, after: number) {
    this.queue.push([x, y, z, before, after]);
    if (this.draining) return;
    this.draining = true;
    try {
      for (let guard = 0; this.queue.length && guard < 10000; guard++) {
        const [cx, cy, cz, b, a] = this.queue.shift()!;
        this.apply(cx, cy, cz, b, a);
      }
    } finally {
      this.queue.length = 0;
      this.draining = false;
    }
  }

  private apply(x: number, y: number, z: number, before: number, after: number) {
    const w = this.world;
    // The other half of a door goes when one half is removed.
    if (isDoor(before) && !isDoor(after)) {
      const other = doorState(before).upper ? y - 1 : y + 1;
      const id = w.getBlock(x, other, z);
      if (isDoor(id) && doorState(id).upper !== doorState(before).upper) {
        if (w.setBlock(x, other, z, B.AIR)) this.hooks.popped(x, other, z, id);
      }
    }
    // Anything that was hanging on this cell.
    for (const [dx, dy, dz] of N6) {
      const nx = x + dx, ny = y + dy, nz = z + dz;
      const id = w.getBlock(nx, ny, nz);
      const dir = supportDir(id);
      if (!dir || nx + dir[0] !== x || ny + dir[1] !== y || nz + dir[2] !== z) continue;
      if (supports(id, after)) continue;
      if (w.setBlock(nx, ny, nz, B.AIR)) this.hooks.popped(nx, ny, nz, id);
    }
    this.hooks.changed(x, y, z, before, after);
  }
}

/** Random source for drops, so tests can pass a stub. */
export type Rand = () => number;

/** The items a harvested block drops: its drop table, plus the classic special cases. */
export function blockDrops(id: number, rand: Rand = Math.random): { id: number; count: number }[] {
  const def = BLOCKS[id];
  if (!def) return [];
  switch (id) {
    case B.GRAVEL:
      return [{ id: rand() < 0.1 ? I.FLINT : B.GRAVEL, count: 1 }];
    case B.TALL_GRASS:
      return rand() < 0.125 ? [{ id: I.SEEDS, count: 1 }] : [];
    case B.LEAVES: {
      const r = rand();
      if (r < 0.05) return [{ id: I.APPLE, count: 1 }];
      return r < 0.13 ? [{ id: I.STICK, count: 1 }] : [];
    }
    case B.BIRCH_LEAVES:
    case B.SPRUCE_LEAVES:
    case B.JUNGLE_LEAVES:
      return rand() < 0.08 ? [{ id: I.STICK, count: 1 }] : [];
  }
  if (id >= B.WHEAT_0 && id <= B.WHEAT_7) {
    if (id < B.WHEAT_7) return [{ id: I.SEEDS, count: 1 }];
    const seeds = Math.floor(rand() * 4);
    return seeds > 0 ? [{ id: I.WHEAT, count: 1 }, { id: I.SEEDS, count: seeds }] : [{ id: I.WHEAT, count: 1 }];
  }
  if (def.drop === null) return [];
  const [lo, hi] = def.dropCount ?? [1, 1];
  return [{ id: def.drop, count: lo + Math.floor(rand() * (hi - lo + 1)) }];
}

/** Experience for mining a block with the right tool. */
export function blockXp(id: number, rand: Rand = Math.random): number {
  const xp = BLOCKS[id]?.xp;
  if (!xp) return 0;
  return xp[0] + Math.floor(rand() * (xp[1] - xp[0] + 1));
}

import { describe, expect, it } from "vitest";
import { B, I, doorState, isLever, switchFace } from "./blocks";
import { doorFacing, placementFor } from "./placement";
import { BlockUpdates, blockDrops } from "./blockUpdates";

const hit = (id: number, nx: number, ny: number, nz: number) => ({ x: 0, y: 1, z: 0, nx, ny, nz, id });

describe("placement", () => {
  it("puts blocks against the clicked face", () => {
    expect(placementFor(B.STONE, hit(B.DIRT, 1, 0, 0), 0)).toEqual([{ x: 1, y: 1, z: 0, id: B.STONE }]);
    expect(placementFor(B.STONE, hit(B.DIRT, 0, 1, 0), 0)).toEqual([{ x: 0, y: 2, z: 0, id: B.STONE }]);
    expect(placementFor(B.STONE, hit(B.DIRT, 0, -1, 0), 0)).toEqual([{ x: 0, y: 0, z: 0, id: B.STONE }]);
  });

  it("replaces tall grass instead of stacking on it", () => {
    expect(placementFor(B.DIRT, hit(B.TALL_GRASS, 0, 1, 0), 0)).toEqual([{ x: 0, y: 1, z: 0, id: B.DIRT }]);
  });

  it("hangs levers on the clicked wall, not on ceilings", () => {
    const plan = placementFor(B.LEVER, hit(B.STONE, 1, 0, 0), 0)!;
    expect(isLever(plan[0].id)).toBe(true);
    expect(switchFace(plan[0].id)).toBe(3); // support lies at -X
    expect(placementFor(B.LEVER, hit(B.STONE, 0, -1, 0), 0)).toBeNull();
  });

  it("plants seeds only on top of farmland", () => {
    expect(placementFor(I.SEEDS, hit(B.FARMLAND, 0, 1, 0), 0)).toEqual([{ x: 0, y: 2, z: 0, id: B.WHEAT_0 }]);
    expect(placementFor(I.SEEDS, hit(B.DIRT, 0, 1, 0), 0)).toBeNull();
  });

  it("places doors as two halves facing the player", () => {
    const plan = placementFor(I.WOODEN_DOOR, hit(B.STONE, 0, 1, 0), Math.PI / 2)!;
    expect(plan).toHaveLength(2);
    expect(doorState(plan[0].id)).toMatchObject({ upper: false, open: false, iron: false, facing: doorFacing(Math.PI / 2) });
    expect(doorState(plan[1].id).upper).toBe(true);
    expect(plan[1].y).toBe(plan[0].y + 1);
  });
});

/** Grid world wired through BlockUpdates like the session does. */
function world() {
  const cells = new Map<string, number>();
  const popped: number[] = [];
  const w = {
    getBlock: (x: number, y: number, z: number) => cells.get(`${x},${y},${z}`) ?? (y <= 0 ? B.DIRT : B.AIR),
    setBlock: (x: number, y: number, z: number, id: number) => {
      const before = w.getBlock(x, y, z);
      if (before === id) return false;
      cells.set(`${x},${y},${z}`, id);
      updates.onChange(x, y, z, before, id);
      return true;
    },
  };
  const updates = new BlockUpdates(w, { popped: (_x, _y, _z, id) => popped.push(id), changed: () => {} });
  return { w, popped };
}

describe("block updates", () => {
  it("pops torches and dust when the block under them goes", () => {
    const { w, popped } = world();
    w.setBlock(0, 1, 0, B.STONE);
    w.setBlock(0, 2, 0, B.TORCH);
    w.setBlock(1, 1, 0, B.STONE);
    w.setBlock(1, 2, 0, B.WIRE_0);
    w.setBlock(0, 1, 0, B.AIR);
    w.setBlock(1, 1, 0, B.AIR);
    expect(w.getBlock(0, 2, 0)).toBe(B.AIR);
    expect(w.getBlock(1, 2, 0)).toBe(B.AIR);
    expect(popped).toEqual([B.TORCH, B.WIRE_0]);
  });

  it("breaking either half of a door removes the other", () => {
    const { w } = world();
    w.setBlock(0, 1, 0, B.WOODEN_DOOR);
    w.setBlock(0, 2, 0, B.WOODEN_DOOR + 1);
    w.setBlock(0, 2, 0, B.AIR);
    expect(w.getBlock(0, 1, 0)).toBe(B.AIR);
  });

  it("wheat pops when its farmland turns to dirt", () => {
    const { w, popped } = world();
    w.setBlock(0, 0, 0, B.FARMLAND);
    w.setBlock(0, 1, 0, B.WHEAT_0 + 3);
    w.setBlock(0, 0, 0, B.DIRT);
    expect(w.getBlock(0, 1, 0)).toBe(B.AIR);
    expect(popped).toEqual([B.WHEAT_0 + 3]);
  });
});

describe("block drops", () => {
  it("follows the drop tables", () => {
    expect(blockDrops(B.STONE)).toEqual([{ id: B.COBBLESTONE, count: 1 }]);
    expect(blockDrops(B.CLAY)).toEqual([{ id: I.CLAY_BALL, count: 4 }]);
    expect(blockDrops(B.GRAVEL, () => 0.05)).toEqual([{ id: I.FLINT, count: 1 }]);
    expect(blockDrops(B.GRAVEL, () => 0.5)).toEqual([{ id: B.GRAVEL, count: 1 }]);
    expect(blockDrops(B.TALL_GRASS, () => 0.1)).toEqual([{ id: I.SEEDS, count: 1 }]);
    expect(blockDrops(B.WHEAT_7, () => 0.6)).toEqual([{ id: I.WHEAT, count: 1 }, { id: I.SEEDS, count: 2 }]);
    expect(blockDrops(B.WHEAT_0 + 2)).toEqual([{ id: I.SEEDS, count: 1 }]);
    expect(blockDrops(B.BIRCH_LEAVES, () => 0.01)).toEqual([{ id: I.STICK, count: 1 }]);
    expect(blockDrops(B.LEAVES, () => 0.01)).toEqual([{ id: I.APPLE, count: 1 }]);
    expect(blockDrops(B.GLASS)).toEqual([]);
  });
});

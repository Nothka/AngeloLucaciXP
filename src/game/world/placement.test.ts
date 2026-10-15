import { describe, expect, it } from "vitest";
import { B, I, doorState, isLever, isWallTorch, supportDir, supports, switchFace, wallTorchFace } from "./blocks";
import { matchRecipe } from "../items/crafting";
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

  it("stands torches on floors and hangs them on walls, never on ceilings", () => {
    expect(placementFor(B.TORCH, hit(B.STONE, 0, 1, 0), 0)).toEqual([{ x: 0, y: 2, z: 0, id: B.TORCH }]);
    const wall = placementFor(B.TORCH, hit(B.STONE, 0, 0, 1), 0)![0];
    expect(isWallTorch(wall.id)).toBe(true);
    expect(wall).toMatchObject({ x: 0, y: 1, z: 1 });
    // It hangs on the block that was clicked (one step back toward -Z).
    expect(supportDir(wall.id)).toEqual([0, 0, -1]);
    expect(wallTorchFace(placementFor(B.TORCH, hit(B.STONE, -1, 0, 0), 0)![0].id)).toBe(4);
    expect(placementFor(B.TORCH, hit(B.STONE, 0, -1, 0), 0)).toBeNull();
    const rs = placementFor(B.REDSTONE_TORCH, hit(B.STONE, 1, 0, 0), 0)![0].id;
    expect(rs).toBe(B.REDSTONE_WALL_TORCH + 2);
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

  it("drops a wall torch when its wall is broken", () => {
    const { w, popped } = world();
    w.setBlock(0, 1, 0, B.STONE);
    w.setBlock(1, 1, 0, B.WALL_TORCH + 2); // face 3: hangs on the block at -X
    w.setBlock(0, 1, 0, B.AIR);
    expect(w.getBlock(1, 1, 0)).toBe(B.AIR);
    expect(popped).toEqual([B.WALL_TORCH + 2]);
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

describe("snow", () => {
  it("settles on full blocks and leaves, not on ice, glass or plants", () => {
    for (const ok of [B.GRASS, B.STONE, B.SNOWY_GRASS, B.LEAVES, B.SPRUCE_LEAVES]) expect(supports(B.SNOW_LAYER, ok)).toBe(true);
    for (const no of [B.ICE, B.AIR, B.TALL_GRASS, B.WATER, B.TORCH]) expect(supports(B.SNOW_LAYER, no)).toBe(false);
  });

  it("gives a snowball when cleared away, and a snow block gives four", () => {
    expect(blockDrops(B.SNOW_LAYER)).toEqual([{ id: I.SNOWBALL, count: 1 }]);
    expect(blockDrops(B.SNOW)).toEqual([{ id: I.SNOWBALL, count: 4 }]);
  });

  it("packs four snowballs back into a snow block", () => {
    const s = { id: I.SNOWBALL, count: 1 };
    expect(matchRecipe([s, s, s, s], 2)?.id).toBe(B.SNOW);
  });

  it("melts away with the block under it, and is built over like tall grass", () => {
    const { w, popped } = world();
    w.setBlock(0, 1, 0, B.STONE);
    w.setBlock(0, 2, 0, B.SNOW_LAYER);
    // Clicking the snow puts the block in its place rather than on top of it.
    expect(placementFor(B.DIRT, { x: 0, y: 2, z: 0, nx: 0, ny: 1, nz: 0, id: B.SNOW_LAYER }, 0)).toEqual([{ x: 0, y: 2, z: 0, id: B.DIRT }]);
    w.setBlock(0, 1, 0, B.AIR);
    expect(w.getBlock(0, 2, 0)).toBe(B.AIR);
    expect(popped).toEqual([B.SNOW_LAYER]);
  });
});

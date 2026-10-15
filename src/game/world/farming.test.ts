import { describe, expect, it } from "vitest";
import { B, I, TOOL_IDS, getItem } from "./blocks";
import { farmlandFor, growthChance, isHydrated } from "./farming";
import { blockDrops } from "./blockUpdates";
import { placementFor } from "./placement";
import { matchRecipe } from "../items/crafting";

/** Flat dirt at y = 0 with a few blocks set. */
function field(cells: [number, number, number, number][]) {
  const map = new Map(cells.map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
  return { getBlock: (x: number, y: number, z: number) => map.get(`${x},${y},${z}`) ?? (y <= 0 ? B.DIRT : B.AIR) };
}

describe("farmland and water", () => {
  it("is moist with water up to 4 blocks away, level with it or one above", () => {
    expect(isHydrated(field([[4, 0, 0, B.WATER]]), 0, 0, 0)).toBe(true);
    expect(isHydrated(field([[4, 0, 4, B.WATER]]), 0, 0, 0)).toBe(true);
    expect(isHydrated(field([[0, 1, 3, B.WATER_FLOW_3]]), 0, 0, 0)).toBe(true);
    expect(isHydrated(field([[5, 0, 0, B.WATER]]), 0, 0, 0)).toBe(false);
    expect(isHydrated(field([[2, -1, 0, B.WATER]]), 0, 0, 0)).toBe(false);
    expect(isHydrated(field([]), 0, 0, 0)).toBe(false);
    expect(farmlandFor(field([[1, 0, 0, B.WATER]]), 0, 0, 0)).toBe(B.FARMLAND_WET);
    expect(farmlandFor(field([]), 0, 0, 0)).toBe(B.FARMLAND);
  });

  it("only grows crops when moist and lit", () => {
    expect(growthChance(B.FARMLAND_WET, 15)).toBeGreaterThan(0);
    expect(growthChance(B.FARMLAND, 15)).toBe(0);
    expect(growthChance(B.FARMLAND_WET, 4)).toBe(0);
  });

  it("takes seeds on either kind of farmland, but not on dirt", () => {
    const hit = (id: number) => ({ x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, id });
    expect(placementFor(I.SEEDS, hit(B.FARMLAND), 0)).toEqual([{ x: 0, y: 1, z: 0, id: B.WHEAT_0 }]);
    expect(placementFor(I.SEEDS, hit(B.FARMLAND_WET), 0)).toEqual([{ x: 0, y: 1, z: 0, id: B.WHEAT_0 }]);
    expect(placementFor(I.SEEDS, hit(B.DIRT), 0)).toBeNull();
  });
});

describe("from grass to bread", () => {
  it("calls the item Seeds", () => {
    expect(getItem(I.SEEDS)?.name).toBe("Seeds");
  });

  it("gets seeds from grass, seeds from young wheat and wheat from ripe wheat", () => {
    expect(blockDrops(B.TALL_GRASS, () => 0.05)).toEqual([{ id: I.SEEDS, count: 1 }]);
    expect(blockDrops(B.WHEAT_0 + 3)).toEqual([{ id: I.SEEDS, count: 1 }]);
    expect(blockDrops(B.WHEAT_7, () => 0)[0]).toEqual({ id: I.WHEAT, count: 1 });
  });

  it("crafts every hoe, either way round", () => {
    const S = { id: I.STICK, count: 1 };
    for (const [head, hoe] of [[B.PLANKS, TOOL_IDS.wooden.hoe], [B.COBBLESTONE, TOOL_IDS.stone.hoe], [I.IRON_INGOT, TOOL_IDS.iron.hoe], [I.GOLD_INGOT, TOOL_IDS.golden.hoe], [I.DIAMOND, TOOL_IDS.diamond.hoe]]) {
      const M = { id: head, count: 1 };
      expect(matchRecipe([M, M, null, null, S, null, null, S, null], 3)?.id).toBe(hoe);
      expect(matchRecipe([M, M, null, S, null, null, S, null, null], 3)?.id).toBe(hoe);
    }
  });

  it("bakes bread from three wheat in a row, on any row of the crafting table", () => {
    const W = { id: I.WHEAT, count: 1 };
    for (let row = 0; row < 3; row++) {
      const grid = Array(9).fill(null);
      grid[row * 3] = grid[row * 3 + 1] = grid[row * 3 + 2] = W;
      expect(matchRecipe(grid, 3)?.id).toBe(I.BREAD);
    }
    // Not in a column, and not in the 2x2 inventory grid.
    expect(matchRecipe([W, null, null, W, null, null, W, null, null], 3)).toBeNull();
    expect(matchRecipe([W, W, null, null], 2)).toBeNull();
  });
});

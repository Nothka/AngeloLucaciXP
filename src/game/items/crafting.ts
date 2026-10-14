import { B, I } from "../world/blocks";
import type { ItemStack } from "./inventory";

interface ShapedRecipe {
  pattern: string[];
  key: Record<string, number>;
  result: ItemStack;
}

interface ShapelessRecipe {
  ingredients: number[];
  result: ItemStack;
}

const shaped: ShapedRecipe[] = [
  { pattern: ["P", "P"], key: { P: B.PLANKS }, result: { id: I.STICK, count: 4 } },
  { pattern: ["PP", "PP"], key: { P: B.PLANKS }, result: { id: B.CRAFTING_TABLE, count: 1 } },
  { pattern: ["C", "S"], key: { C: I.COAL, S: I.STICK }, result: { id: B.TORCH, count: 4 } },
  { pattern: ["PPP", " S ", " S "], key: { P: B.PLANKS, S: I.STICK }, result: { id: I.WOODEN_PICKAXE, count: 1 } },
  { pattern: ["CCC", " S ", " S "], key: { C: B.COBBLESTONE, S: I.STICK }, result: { id: I.STONE_PICKAXE, count: 1 } },
  { pattern: ["PP", "PS", " S"], key: { P: B.PLANKS, S: I.STICK }, result: { id: I.WOODEN_AXE, count: 1 } },
  { pattern: ["CC", "CS", " S"], key: { C: B.COBBLESTONE, S: I.STICK }, result: { id: I.STONE_AXE, count: 1 } },
  { pattern: ["P", "S", "S"], key: { P: B.PLANKS, S: I.STICK }, result: { id: I.WOODEN_SHOVEL, count: 1 } },
  { pattern: ["C", "S", "S"], key: { C: B.COBBLESTONE, S: I.STICK }, result: { id: I.STONE_SHOVEL, count: 1 } },
  // Swords: blade of two material blocks over a stick, in any column of the grid.
  { pattern: ["P", "P", "S"], key: { P: B.PLANKS, S: I.STICK }, result: { id: I.WOODEN_SWORD, count: 1 } },
  { pattern: ["C", "C", "S"], key: { C: B.COBBLESTONE, S: I.STICK }, result: { id: I.STONE_SWORD, count: 1 } },
  { pattern: ["C", "C", "S"], key: { C: B.STONE, S: I.STICK }, result: { id: I.STONE_SWORD, count: 1 } },
  { pattern: [" S ", "SCS", " S "], key: { S: B.SAND, C: I.COAL }, result: { id: B.GLASS, count: 4 } },
  // Bow: three sticks curved around three strings (mirrored also works).
  { pattern: [" SX", "S X", " SX"], key: { S: I.STICK, X: I.STRING }, result: { id: I.BOW, count: 1 } },
  // Arrows: a stone tip, a stick shaft and feather fletching.
  { pattern: ["C", "S", "F"], key: { C: B.COBBLESTONE, S: I.STICK, F: I.FEATHER }, result: { id: I.ARROW, count: 4 } },
  { pattern: ["SS", "SS"], key: { S: B.SAND }, result: { id: B.SANDSTONE, count: 1 } },
];

const shapeless: ShapelessRecipe[] = [
  { ingredients: [B.LOG], result: { id: B.PLANKS, count: 4 } },
];

type Grid = (number | null)[][];

/** Crops a grid to the bounding box of its non-empty cells. */
function trim(grid: Grid): Grid {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  let minR = rows, maxR = -1, minC = cols, maxC = -1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== null) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
    }
  }
  if (maxR < 0) return [];
  return grid.slice(minR, maxR + 1).map((row) => row.slice(minC, maxC + 1));
}

const patternGrid = (r: ShapedRecipe): Grid => trim(r.pattern.map((row) => [...row].map((ch) => (ch === " " ? null : r.key[ch]))));
const PATTERNS = shaped.map((r) => ({ recipe: r, grid: patternGrid(r) }));

const sameGrid = (a: Grid, b: Grid) =>
  a.length === b.length && a.every((row, i) => row.length === b[i].length && row.every((v, j) => v === b[i][j]));

/** Finds the result for a square crafting grid (row-major slots). Mirrored shapes also match. */
export function matchRecipe(slots: (ItemStack | null)[], size: number): ItemStack | null {
  const grid: Grid = [];
  for (let r = 0; r < size; r++) grid.push(slots.slice(r * size, r * size + size).map((s) => (s ? s.id : null)));
  const g = trim(grid);
  if (!g.length) return null;
  const mirrored = g.map((row) => [...row].reverse());
  for (const { recipe, grid: p } of PATTERNS) {
    if (p.length > size || (p[0]?.length ?? 0) > size) continue;
    if (sameGrid(g, p) || sameGrid(mirrored, p)) return { ...recipe.result };
  }
  const items = slots.filter((s): s is ItemStack => !!s).map((s) => s.id).sort();
  for (const r of shapeless) {
    const need = [...r.ingredients].sort();
    if (need.length === items.length && need.every((v, i) => v === items[i])) return { ...r.result };
  }
  return null;
}

import { ARMOR_IDS, B, I, TOOL_IDS, type ToolKind, type ToolMaterial } from "../world/blocks";
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

const TOOL_PATTERNS: Record<ToolKind, string[]> = {
  pickaxe: ["MMM", " S ", " S "],
  axe: ["MM", "MS", " S"],
  shovel: ["M", "S", "S"],
  sword: ["M", "M", "S"],
  hoe: ["MM", " S", " S"],
};
/** Head material for each tool tier (stone tools also take smooth stone). */
const TOOL_HEADS: [ToolMaterial, number][] = [
  ["wooden", B.PLANKS], ["stone", B.COBBLESTONE], ["stone", B.STONE], ["iron", I.IRON_INGOT], ["golden", I.GOLD_INGOT], ["diamond", I.DIAMOND],
];

const shaped: ShapedRecipe[] = [
  { pattern: ["P", "P"], key: { P: B.PLANKS }, result: { id: I.STICK, count: 4 } },
  { pattern: ["PP", "PP"], key: { P: B.PLANKS }, result: { id: B.CRAFTING_TABLE, count: 1 } },
  { pattern: ["CCC", "C C", "CCC"], key: { C: B.COBBLESTONE }, result: { id: B.FURNACE, count: 1 } },
  { pattern: ["C", "S"], key: { C: I.COAL, S: I.STICK }, result: { id: B.TORCH, count: 4 } },
  ...TOOL_HEADS.flatMap(([material, head]) =>
    (Object.keys(TOOL_PATTERNS) as ToolKind[]).map((kind) => ({
      pattern: TOOL_PATTERNS[kind], key: { M: head, S: I.STICK }, result: { id: TOOL_IDS[material][kind], count: 1 },
    })),
  ),
  // Bow: three sticks curved around three strings (mirrored also works).
  { pattern: [" SX", "S X", " SX"], key: { S: I.STICK, X: I.STRING }, result: { id: I.BOW, count: 1 } },
  // Arrows: flint (or a stone tip), a stick shaft and feather fletching.
  { pattern: ["C", "S", "F"], key: { C: I.FLINT, S: I.STICK, F: I.FEATHER }, result: { id: I.ARROW, count: 4 } },
  { pattern: ["C", "S", "F"], key: { C: B.COBBLESTONE, S: I.STICK, F: I.FEATHER }, result: { id: I.ARROW, count: 4 } },
  { pattern: ["  S", " SX", "S X"], key: { S: I.STICK, X: I.STRING }, result: { id: I.FISHING_ROD, count: 1 } },
  { pattern: ["SS", "SS"], key: { S: B.SAND }, result: { id: B.SANDSTONE, count: 1 } },
  { pattern: ["SS", "SS"], key: { S: I.SNOWBALL }, result: { id: B.SNOW, count: 1 } },
  { pattern: ["BB", "BB"], key: { B: I.BRICK }, result: { id: B.BRICKS, count: 1 } },
  { pattern: ["CC", "CC"], key: { C: I.CLAY_BALL }, result: { id: B.CLAY, count: 1 } },
  { pattern: ["WWW"], key: { W: I.WHEAT }, result: { id: I.BREAD, count: 1 } },
  { pattern: ["I I", " I "], key: { I: I.IRON_INGOT }, result: { id: I.BUCKET, count: 1 } },
  { pattern: ["PP", "PP", "PP"], key: { P: B.PLANKS }, result: { id: I.WOODEN_DOOR, count: 3 } },
  { pattern: ["II", "II", "II"], key: { I: I.IRON_INGOT }, result: { id: I.IRON_DOOR, count: 3 } },
  ...([[I.IRON_INGOT, ARMOR_IDS.iron], [I.GOLD_INGOT, ARMOR_IDS.golden], [I.DIAMOND, ARMOR_IDS.diamond]] as const).flatMap(([m, [helmet, chest, legs, boots]]) => [
    { pattern: ["III", "I I"], key: { I: m }, result: { id: helmet, count: 1 } },
    { pattern: ["I I", "III", "III"], key: { I: m }, result: { id: chest, count: 1 } },
    { pattern: ["III", "I I", "I I"], key: { I: m }, result: { id: legs, count: 1 } },
    { pattern: ["I I", "I I"], key: { I: m }, result: { id: boots, count: 1 } },
  ]),
  // Redstone components.
  { pattern: ["R", "S"], key: { R: I.REDSTONE, S: I.STICK }, result: { id: B.REDSTONE_TORCH, count: 1 } },
  { pattern: ["S", "C"], key: { S: I.STICK, C: B.COBBLESTONE }, result: { id: B.LEVER, count: 1 } },
  { pattern: ["SS"], key: { S: B.STONE }, result: { id: B.PRESSURE_PLATE, count: 1 } },
];

const shapeless: ShapelessRecipe[] = [
  { ingredients: [B.LOG], result: { id: B.PLANKS, count: 4 } },
  { ingredients: [B.BIRCH_LOG], result: { id: B.PLANKS, count: 4 } },
  { ingredients: [B.SPRUCE_LOG], result: { id: B.PLANKS, count: 4 } },
  { ingredients: [B.JUNGLE_LOG], result: { id: B.PLANKS, count: 4 } },
  { ingredients: [B.STONE], result: { id: B.BUTTON, count: 1 } },
  // Old saves: loose wool becomes a block.
  { ingredients: [I.WOOL], result: { id: B.WOOL_WHITE, count: 1 } },
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

import { B, I, TOOL_INFO } from "../world/blocks";

/** What comes out of the furnace for each input. */
export const SMELTING: Record<number, number> = {
  [B.IRON_ORE]: I.IRON_INGOT,
  [B.GOLD_ORE]: I.GOLD_INGOT,
  [B.DIAMOND_ORE]: I.DIAMOND,
  [B.LAPIS_ORE]: I.LAPIS,
  [B.REDSTONE_ORE]: I.REDSTONE,
  [B.COAL_ORE]: I.COAL,
  [B.SAND]: B.GLASS,
  [B.COBBLESTONE]: B.STONE,
  [B.CLAY]: B.BRICKS,
  [I.CLAY_BALL]: I.BRICK,
  [B.LOG]: I.COAL,
  [B.BIRCH_LOG]: I.COAL,
  [B.SPRUCE_LOG]: I.COAL,
  [B.JUNGLE_LOG]: I.COAL,
  [I.RAW_PORKCHOP]: I.COOKED_PORKCHOP,
  [I.RAW_MEAT]: I.STEAK,
  [I.RAW_CHICKEN]: I.COOKED_CHICKEN,
  [I.RAW_FISH]: I.COOKED_FISH,
  [B.ICE]: B.WATER,
};

/** Experience per item smelted (awarded when the output is taken). */
export const SMELT_XP: Record<number, number> = {
  [I.IRON_INGOT]: 0.7, [I.GOLD_INGOT]: 1, [I.DIAMOND]: 1, [I.COOKED_PORKCHOP]: 0.35, [I.STEAK]: 0.35,
  [I.COOKED_CHICKEN]: 0.35, [I.COOKED_FISH]: 0.35, [B.GLASS]: 0.1, [B.STONE]: 0.1, [I.BRICK]: 0.3,
};

/** Seconds of burning a fuel item gives (one smelt takes 10 s). */
export function fuelSeconds(id: number): number {
  if (id === I.COAL) return 80;
  if (id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG || id === B.JUNGLE_LOG || id === B.PLANKS) return 15;
  if (id === B.CRAFTING_TABLE) return 15;
  if (id === I.STICK) return 5;
  if (id === I.WOODEN_DOOR) return 10;
  const tool = TOOL_INFO.get(id);
  if (tool?.material === "wooden") return 10;
  if (id === I.BOW || id === I.FISHING_ROD) return 15;
  return 0;
}

export const SMELT_SECONDS = 10;

export const smeltResult = (id: number): number | null => (id === B.ICE ? null : SMELTING[id] ?? null);

/**
 * Block and item registry. Pure data (no DOM) so the mesher worker can import it.
 * Block ids double as item ids for their block item; non-block items start at 256.
 *
 * The world stores one byte per cell, so blocks with state (redstone power,
 * door open/closed, lever on/off, water level) use one id per state. Helpers
 * at the bottom of this file convert between ids and states.
 */

export const TILE_NAMES = [
  "grass_top", "grass_side", "dirt", "stone", "cobblestone", "sand",
  "sandstone_top", "sandstone_side", "sandstone_bottom", "log_side", "log_top", "leaves",
  "planks", "glass", "water", "coal_ore", "torch", "crafting_table_top",
  "crafting_table_side", "crafting_table_front", "bedrock", "tall_grass", "flower_yellow", "flower_red",
  "snow", "grass_side_snow",
  // v2 additions
  "gravel", "birch_log_side", "birch_log_top", "birch_leaves", "spruce_log_side", "spruce_log_top",
  "spruce_leaves", "jungle_log_side", "jungle_log_top", "jungle_leaves", "clay", "obsidian",
  "bricks", "ice", "wool_white", "wool_black", "wool_gray", "wool_light_gray",
  "wool_brown", "wool_pink", "iron_ore", "gold_ore", "diamond_ore", "lapis_ore",
  "redstone_ore", "furnace_front", "furnace_front_lit", "furnace_side", "furnace_top", "farmland",
  "wheat_0", "wheat_1", "wheat_2", "wheat_3", "wheat_4", "wheat_5", "wheat_6", "wheat_7",
  "wire_cross_0", "wire_cross_1", "wire_cross_2", "wire_cross_3",
  "wire_line_0", "wire_line_1", "wire_line_2", "wire_line_3",
  "redstone_torch_on", "redstone_torch_off", "lever", "door_wood_lower", "door_wood_upper",
  "door_iron_lower", "door_iron_upper",
] as const;

export type TileName = (typeof TILE_NAMES)[number];
export const TILE: Record<TileName, number> = Object.fromEntries(
  TILE_NAMES.map((name, index) => [name, index])
) as Record<TileName, number>;

export enum B {
  AIR = 0,
  GRASS = 1,
  DIRT = 2,
  STONE = 3,
  COBBLESTONE = 4,
  SAND = 5,
  SANDSTONE = 6,
  LOG = 7,
  LEAVES = 8,
  PLANKS = 9,
  GLASS = 10,
  WATER = 11,
  COAL_ORE = 12,
  TORCH = 13,
  CRAFTING_TABLE = 14,
  BEDROCK = 15,
  TALL_GRASS = 16,
  FLOWER_YELLOW = 17,
  FLOWER_RED = 18,
  SNOWY_GRASS = 19,
  SNOW = 20,
  /** Flowing water, levels 1..7 (7 is next to the source). Levels 4..7 live at 129..132. */
  WATER_FLOW_1 = 21,
  WATER_FLOW_2 = 22,
  WATER_FLOW_3 = 23,
  GRAVEL = 24,
  BIRCH_LOG = 25,
  BIRCH_LEAVES = 26,
  SPRUCE_LOG = 27,
  SPRUCE_LEAVES = 28,
  JUNGLE_LOG = 29,
  JUNGLE_LEAVES = 30,
  CLAY = 31,
  OBSIDIAN = 32,
  BRICKS = 33,
  ICE = 34,
  WOOL_WHITE = 35,
  WOOL_BLACK = 36,
  WOOL_GRAY = 37,
  WOOL_LIGHT_GRAY = 38,
  WOOL_BROWN = 39,
  WOOL_PINK = 40,
  IRON_ORE = 41,
  GOLD_ORE = 42,
  DIAMOND_ORE = 43,
  LAPIS_ORE = 44,
  REDSTONE_ORE = 45,
  FURNACE = 46,
  FURNACE_LIT = 47,
  FARMLAND = 48,
  /** Wheat crop, growth stages 0..7 at 49..56. */
  WHEAT_0 = 49,
  WHEAT_7 = 56,
  /** Redstone dust, power 0..15 at 57..72. */
  WIRE_0 = 57,
  WIRE_15 = 72,
  REDSTONE_TORCH = 73,
  REDSTONE_TORCH_OFF = 74,
  /** Levers: 75 + face * 2 + on (face 0 = floor, 1..4 = walls). */
  LEVER = 75,
  /** Stone buttons, same layout as levers. */
  BUTTON = 85,
  PRESSURE_PLATE = 95,
  PRESSURE_PLATE_ON = 96,
  /** Doors: base + facing * 4 + open * 2 + upper. */
  WOODEN_DOOR = 97,
  IRON_DOOR = 113,
  WATER_FLOW_4 = 129,
  WATER_FLOW_5 = 130,
  WATER_FLOW_6 = 131,
  WATER_FLOW_7 = 132,
  WATER_FALLING = 133,
  /** Torches on the side of a block: base + face - 1 (faces 1..4 as in ATTACH_DIRS). */
  WALL_TORCH = 134,
  REDSTONE_WALL_TORCH = 138,
  REDSTONE_WALL_TORCH_OFF = 142,
  /** A thin layer of snow (2/16 of a block) lying on top of the block below. */
  SNOW_LAYER = 146,
}

export enum I {
  STICK = 256,
  COAL = 257,
  WOODEN_PICKAXE = 258,
  STONE_PICKAXE = 259,
  WOODEN_AXE = 260,
  STONE_AXE = 261,
  WOODEN_SHOVEL = 262,
  STONE_SHOVEL = 263,
  APPLE = 264,
  WOODEN_SWORD = 265,
  STONE_SWORD = 266,
  /** Legacy loose wool (old saves); sheep now drop wool blocks. */
  WOOL = 267,
  FEATHER = 268,
  /** Raw beef (kept at the old "raw meat" id so saves carry over). */
  RAW_MEAT = 269,
  BONE = 270,
  STRING = 271,
  ARROW = 272,
  BOW = 273,
  IRON_HELMET = 274,
  IRON_CHESTPLATE = 275,
  IRON_LEGGINGS = 276,
  IRON_BOOTS = 277,
  IRON_INGOT = 278,
  GOLD_INGOT = 279,
  DIAMOND = 280,
  LAPIS = 281,
  REDSTONE = 282,
  CLAY_BALL = 283,
  BRICK = 284,
  FLINT = 285,
  WHEAT = 286,
  SEEDS = 287,
  BREAD = 288,
  RAW_PORKCHOP = 289,
  COOKED_PORKCHOP = 290,
  STEAK = 291,
  RAW_CHICKEN = 292,
  COOKED_CHICKEN = 293,
  RAW_FISH = 294,
  COOKED_FISH = 295,
  BUCKET = 296,
  WATER_BUCKET = 297,
  FISHING_ROD = 298,
  WOODEN_DOOR = 299,
  IRON_DOOR = 300,
  EGG = 301,
  SNOWBALL = 303,
  MILK_BUCKET = 302,
  IRON_PICKAXE = 310,
  IRON_AXE = 311,
  IRON_SHOVEL = 312,
  IRON_SWORD = 313,
  GOLDEN_PICKAXE = 314,
  GOLDEN_AXE = 315,
  GOLDEN_SHOVEL = 316,
  GOLDEN_SWORD = 317,
  DIAMOND_PICKAXE = 318,
  DIAMOND_AXE = 319,
  DIAMOND_SHOVEL = 320,
  DIAMOND_SWORD = 321,
  WOODEN_HOE = 322,
  STONE_HOE = 323,
  IRON_HOE = 324,
  GOLDEN_HOE = 325,
  DIAMOND_HOE = 326,
}

/** Armor slots, top to bottom. */
export type ArmorSlot = 0 | 1 | 2 | 3;

export type Shape = "none" | "cube" | "cross" | "torch" | "liquid" | "wire" | "lever" | "button" | "plate" | "door" | "layer";
export type RenderPass = "opaque" | "cutout" | "water";
export type ToolType = "pickaxe" | "axe" | "shovel" | "sword" | "hoe";
export type SoundKind = "grass" | "stone" | "wood" | "sand" | "snow" | "glass" | "cloth" | "none";

export interface BlockDef {
  id: number;
  name: string;
  tiles: { top: number; bottom: number; side: number; front?: number };
  shape: Shape;
  pass: RenderPass;
  /** Collides with entities. */
  solid: boolean;
  /** Fully hides neighbouring faces and blocks all light. */
  opaque: boolean;
  /** How much light is lost passing through (0 = clear, 15 = blocks everything). */
  lightOpacity: number;
  emit: number;
  /** Seconds-ish base value; -1 = unbreakable. */
  hardness: number;
  tool: ToolType | null;
  /** Without the right tool the block breaks slowly and drops nothing. */
  needsTool: boolean;
  /** Lowest tool tier that harvests it (1 wood/gold, 2 stone, 3 iron, 4 diamond). */
  minTier: number;
  /** Item dropped when harvested; null drops nothing. */
  drop: number | null;
  /** How many of `drop` (random in the range). */
  dropCount?: [number, number];
  /** Experience dropped when mined with the right tool. */
  xp?: [number, number];
  sound: SoundKind;
  /** Can be overwritten by placing a block into it. */
  replaceable: boolean;
  /** Pops off (and drops) when the block it hangs on goes away. */
  needsSupport: boolean;
  /** Falls when nothing is underneath (sand, gravel). */
  gravity?: boolean;
  /** No item of its own (crop stages, wire power levels, lit furnace...). */
  noItem?: boolean;
}

const all = (tile: number) => ({ top: tile, bottom: tile, side: tile });

const defaults: Omit<BlockDef, "id" | "name" | "tiles"> = {
  shape: "cube",
  pass: "opaque",
  solid: true,
  opaque: true,
  lightOpacity: 15,
  emit: 0,
  hardness: 1,
  tool: null,
  needsTool: false,
  minTier: 0,
  drop: null,
  sound: "stone",
  replaceable: false,
  needsSupport: false,
};

const defs: BlockDef[] = [];
const define = (id: number, name: string, tiles: BlockDef["tiles"], props: Partial<BlockDef> = {}) => {
  defs[id] = { ...defaults, id, name, tiles, drop: id, ...props };
  if (defs[id].needsTool && !defs[id].minTier) defs[id].minTier = 1;
};

const plant = { shape: "cross", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0, sound: "grass", needsSupport: true } as const;
const leaves = { pass: "cutout", opaque: false, lightOpacity: 1, hardness: 0.2, sound: "grass", drop: null, tool: "sword" } as const;
const ore = (minTier: number, hardness = 3) => ({ hardness, tool: "pickaxe" as const, needsTool: true, minTier });
const fluid = { shape: "liquid", pass: "water", solid: false, opaque: false, lightOpacity: 2, hardness: -1, drop: null, sound: "none", replaceable: true, noItem: true } as const;

define(B.AIR, "Air", all(0), {
  shape: "none", solid: false, opaque: false, lightOpacity: 0, hardness: 0, drop: null, sound: "none", replaceable: true,
});
define(B.GRASS, "Grass Block", { top: TILE.grass_top, bottom: TILE.dirt, side: TILE.grass_side }, {
  hardness: 0.6, tool: "shovel", drop: B.DIRT, sound: "grass",
});
define(B.DIRT, "Dirt", all(TILE.dirt), { hardness: 0.5, tool: "shovel", sound: "grass" });
define(B.STONE, "Stone", all(TILE.stone), { hardness: 1.5, tool: "pickaxe", needsTool: true, drop: B.COBBLESTONE });
define(B.COBBLESTONE, "Cobblestone", all(TILE.cobblestone), { hardness: 2, tool: "pickaxe", needsTool: true });
define(B.SAND, "Sand", all(TILE.sand), { hardness: 0.5, tool: "shovel", sound: "sand", gravity: true });
define(B.SANDSTONE, "Sandstone", { top: TILE.sandstone_top, bottom: TILE.sandstone_bottom, side: TILE.sandstone_side }, {
  hardness: 0.8, tool: "pickaxe", needsTool: true,
});
define(B.LOG, "Oak Log", { top: TILE.log_top, bottom: TILE.log_top, side: TILE.log_side }, { hardness: 2, tool: "axe", sound: "wood" });
define(B.LEAVES, "Oak Leaves", all(TILE.leaves), leaves);
define(B.PLANKS, "Oak Planks", all(TILE.planks), { hardness: 2, tool: "axe", sound: "wood" });
define(B.GLASS, "Glass", all(TILE.glass), { pass: "cutout", opaque: false, lightOpacity: 0, hardness: 0.3, sound: "glass", drop: null });
define(B.WATER, "Water", all(TILE.water), fluid);
define(B.COAL_ORE, "Coal Ore", all(TILE.coal_ore), { ...ore(1), drop: I.COAL, xp: [0, 2] });
define(B.TORCH, "Torch", all(TILE.torch), {
  shape: "torch", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, emit: 14, hardness: 0, sound: "wood", needsSupport: true,
});
define(B.CRAFTING_TABLE, "Crafting Table", {
  top: TILE.crafting_table_top, bottom: TILE.planks, side: TILE.crafting_table_side, front: TILE.crafting_table_front,
}, { hardness: 2.5, tool: "axe", sound: "wood" });
define(B.BEDROCK, "Bedrock", all(TILE.bedrock), { hardness: -1, drop: null });
define(B.TALL_GRASS, "Tall Grass", all(TILE.tall_grass), { ...plant, drop: null, replaceable: true });
define(B.FLOWER_YELLOW, "Dandelion", all(TILE.flower_yellow), plant);
define(B.FLOWER_RED, "Poppy", all(TILE.flower_red), plant);
define(B.SNOWY_GRASS, "Snowy Grass", { top: TILE.snow, bottom: TILE.dirt, side: TILE.grass_side_snow }, {
  hardness: 0.6, tool: "shovel", drop: B.DIRT, sound: "snow",
});
define(B.SNOW, "Snow Block", all(TILE.snow), { hardness: 0.2, tool: "shovel", sound: "snow", drop: I.SNOWBALL, dropCount: [4, 4] });
define(B.SNOW_LAYER, "Snow", all(TILE.snow), {
  shape: "layer", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0.1, tool: "shovel",
  sound: "snow", replaceable: true, needsSupport: true, drop: I.SNOWBALL,
});

// ---- terrain and decoration
define(B.GRAVEL, "Gravel", all(TILE.gravel), { hardness: 0.6, tool: "shovel", sound: "sand", gravity: true });
define(B.BIRCH_LOG, "Birch Log", { top: TILE.birch_log_top, bottom: TILE.birch_log_top, side: TILE.birch_log_side }, { hardness: 2, tool: "axe", sound: "wood" });
define(B.BIRCH_LEAVES, "Birch Leaves", all(TILE.birch_leaves), leaves);
define(B.SPRUCE_LOG, "Spruce Log", { top: TILE.spruce_log_top, bottom: TILE.spruce_log_top, side: TILE.spruce_log_side }, { hardness: 2, tool: "axe", sound: "wood" });
define(B.SPRUCE_LEAVES, "Spruce Leaves", all(TILE.spruce_leaves), leaves);
define(B.JUNGLE_LOG, "Jungle Log", { top: TILE.jungle_log_top, bottom: TILE.jungle_log_top, side: TILE.jungle_log_side }, { hardness: 2, tool: "axe", sound: "wood" });
define(B.JUNGLE_LEAVES, "Jungle Leaves", all(TILE.jungle_leaves), leaves);
define(B.CLAY, "Clay", all(TILE.clay), { hardness: 0.6, tool: "shovel", sound: "grass", drop: I.CLAY_BALL, dropCount: [4, 4] });
define(B.OBSIDIAN, "Obsidian", all(TILE.obsidian), { hardness: 50, tool: "pickaxe", needsTool: true, minTier: 4 });
define(B.BRICKS, "Bricks", all(TILE.bricks), { hardness: 2, tool: "pickaxe", needsTool: true });
define(B.ICE, "Ice", all(TILE.ice), { hardness: 0.5, tool: "pickaxe", sound: "glass", drop: null, lightOpacity: 2 });
const WOOL: [number, string, TileName][] = [
  [B.WOOL_WHITE, "White Wool", "wool_white"], [B.WOOL_BLACK, "Black Wool", "wool_black"],
  [B.WOOL_GRAY, "Gray Wool", "wool_gray"], [B.WOOL_LIGHT_GRAY, "Light Gray Wool", "wool_light_gray"],
  [B.WOOL_BROWN, "Brown Wool", "wool_brown"], [B.WOOL_PINK, "Pink Wool", "wool_pink"],
];
for (const [id, name, tile] of WOOL) define(id, name, all(TILE[tile]), { hardness: 0.8, sound: "cloth" });

// ---- ores
define(B.IRON_ORE, "Iron Ore", all(TILE.iron_ore), ore(2));
define(B.GOLD_ORE, "Gold Ore", all(TILE.gold_ore), ore(3));
define(B.DIAMOND_ORE, "Diamond Ore", all(TILE.diamond_ore), { ...ore(3), drop: I.DIAMOND, xp: [3, 7] });
define(B.LAPIS_ORE, "Lapis Lazuli Ore", all(TILE.lapis_ore), { ...ore(2), drop: I.LAPIS, dropCount: [4, 8], xp: [2, 5] });
define(B.REDSTONE_ORE, "Redstone Ore", all(TILE.redstone_ore), { ...ore(3), drop: I.REDSTONE, dropCount: [4, 5], xp: [1, 5] });

// ---- crafted blocks with state
define(B.FURNACE, "Furnace", { top: TILE.furnace_top, bottom: TILE.furnace_top, side: TILE.furnace_side, front: TILE.furnace_front }, {
  hardness: 3.5, tool: "pickaxe", needsTool: true,
});
define(B.FURNACE_LIT, "Lit Furnace", { top: TILE.furnace_top, bottom: TILE.furnace_top, side: TILE.furnace_side, front: TILE.furnace_front_lit }, {
  hardness: 3.5, tool: "pickaxe", needsTool: true, emit: 13, drop: B.FURNACE, noItem: true,
});
define(B.FARMLAND, "Farmland", { top: TILE.farmland, bottom: TILE.dirt, side: TILE.dirt }, { hardness: 0.6, tool: "shovel", sound: "grass", drop: B.DIRT, noItem: true });
for (let s = 0; s < 8; s++) {
  define(B.WHEAT_0 + s, `Wheat (stage ${s})`, all(TILE.wheat_0 + s), { ...plant, drop: null, noItem: true });
}
for (let p = 0; p < 16; p++) {
  define(B.WIRE_0 + p, "Redstone Dust", all(TILE.wire_cross_0), {
    shape: "wire", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0, sound: "stone",
    needsSupport: true, drop: I.REDSTONE, noItem: true,
  });
}
define(B.REDSTONE_TORCH, "Redstone Torch", all(TILE.redstone_torch_on), {
  shape: "torch", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, emit: 7, hardness: 0, sound: "wood", needsSupport: true,
});
define(B.REDSTONE_TORCH_OFF, "Redstone Torch (off)", all(TILE.redstone_torch_off), {
  shape: "torch", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0, sound: "wood", needsSupport: true,
  drop: B.REDSTONE_TORCH, noItem: true,
});
for (let f = 0; f < 4; f++) {
  const wall = { shape: "torch", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0, sound: "wood", needsSupport: true, noItem: true } as const;
  define(B.WALL_TORCH + f, "Torch", all(TILE.torch), { ...wall, emit: 14, drop: B.TORCH });
  define(B.REDSTONE_WALL_TORCH + f, "Redstone Torch", all(TILE.redstone_torch_on), { ...wall, emit: 7, drop: B.REDSTONE_TORCH });
  define(B.REDSTONE_WALL_TORCH_OFF + f, "Redstone Torch (off)", all(TILE.redstone_torch_off), { ...wall, drop: B.REDSTONE_TORCH });
}
for (let i = 0; i < 10; i++) {
  const thin = { pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0.5, needsSupport: true } as const;
  define(B.LEVER + i, "Lever", { top: TILE.cobblestone, bottom: TILE.cobblestone, side: TILE.lever }, {
    ...thin, shape: "lever", sound: "wood", drop: B.LEVER, noItem: i !== 0,
  });
  define(B.BUTTON + i, "Stone Button", all(TILE.stone), { ...thin, shape: "button", sound: "stone", drop: B.BUTTON, noItem: i !== 0 });
}
define(B.PRESSURE_PLATE, "Stone Pressure Plate", all(TILE.stone), {
  shape: "plate", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0.5, needsSupport: true, drop: B.PRESSURE_PLATE,
});
define(B.PRESSURE_PLATE_ON, "Stone Pressure Plate", all(TILE.stone), {
  shape: "plate", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0.5, needsSupport: true, drop: B.PRESSURE_PLATE, noItem: true,
});
for (let i = 0; i < 16; i++) {
  const open = (i >> 1) & 1;
  const upper = i & 1;
  const door = { shape: "door", pass: "cutout", opaque: false, lightOpacity: 0, needsSupport: true, noItem: true, solid: !open } as const;
  define(B.WOODEN_DOOR + i, "Wooden Door", all(upper ? TILE.door_wood_upper : TILE.door_wood_lower), { ...door, hardness: 3, tool: "axe", sound: "wood", drop: upper ? null : I.WOODEN_DOOR });
  define(B.IRON_DOOR + i, "Iron Door", all(upper ? TILE.door_iron_upper : TILE.door_iron_lower), { ...door, hardness: 5, tool: "pickaxe", needsTool: true, sound: "stone", drop: upper ? null : I.IRON_DOOR });
}

// ---- water: source, seven flowing levels and falling water
const FLOW_IDS = [0, B.WATER_FLOW_1, B.WATER_FLOW_2, B.WATER_FLOW_3, B.WATER_FLOW_4, B.WATER_FLOW_5, B.WATER_FLOW_6, B.WATER_FLOW_7];
for (let l = 1; l <= 7; l++) define(FLOW_IDS[l], `Flowing Water (${l})`, all(TILE.water), fluid);
define(B.WATER_FALLING, "Falling Water", all(TILE.water), fluid);

export const BLOCKS = defs;
export const BLOCK_COUNT = defs.length;

// Flat lookup tables for the hot loops in lighting and meshing.
export const IS_OPAQUE = new Uint8Array(256);
export const IS_SOLID = new Uint8Array(256);
export const LIGHT_OPACITY = new Uint8Array(256);
export const EMIT = new Uint8Array(256);
/** 0 none, 1 cube, 2 cross, 3 torch, 4 liquid, 5 wire, 6 lever, 7 button, 8 plate, 9 door */
export const SHAPE_CODE = new Uint8Array(256);
export const PASS_CODE = new Uint8Array(256); // 0 opaque, 1 cutout, 2 water
export const TILE_TOP = new Uint8Array(256);
export const TILE_BOTTOM = new Uint8Array(256);
export const TILE_SIDE = new Uint8Array(256);
export const TILE_FRONT = new Uint8Array(256);

/**
 * Water levels: 8 = source, 9 = falling, 7..1 = flowing (7 next to the
 * source, each block of distance one less), 0 = not water.
 */
export const FLUID_LEVEL = new Uint8Array(256);
FLUID_LEVEL[B.WATER] = 8;
FLUID_LEVEL[B.WATER_FALLING] = 9;
for (let l = 1; l <= 7; l++) FLUID_LEVEL[FLOW_IDS[l]] = l;
/** Block id for a water level (0 = air). */
export const waterBlock = (level: number) => (level <= 0 ? B.AIR : level === 8 ? B.WATER : level >= 9 ? B.WATER_FALLING : FLOW_IDS[level]);
export const isWater = (id: number) => FLUID_LEVEL[id] > 0;
export const isWaterSource = (id: number) => id === B.WATER;

/**
 * Height of a water surface in 1/16 block units: sources and level 7 sit at
 * 14/16, each step away is a little lower, falling water and water with
 * water above it are full.
 */
export function waterHeight16(id: number, above: number): number {
  const level = FLUID_LEVEL[id];
  if (!level) return 0;
  if (FLUID_LEVEL[above] || level === 9) return 16;
  const l = level === 8 ? 7 : level;
  return Math.max(2, Math.round((16 * (l + 1)) / 9));
}

const SHAPES: Shape[] = ["none", "cube", "cross", "torch", "liquid", "wire", "lever", "button", "plate", "door", "layer"];
const PASSES: RenderPass[] = ["opaque", "cutout", "water"];
for (const def of defs) {
  if (!def) continue;
  IS_OPAQUE[def.id] = def.opaque ? 1 : 0;
  IS_SOLID[def.id] = def.solid ? 1 : 0;
  LIGHT_OPACITY[def.id] = def.lightOpacity;
  EMIT[def.id] = def.emit;
  SHAPE_CODE[def.id] = SHAPES.indexOf(def.shape);
  PASS_CODE[def.id] = PASSES.indexOf(def.pass);
  TILE_TOP[def.id] = def.tiles.top;
  TILE_BOTTOM[def.id] = def.tiles.bottom;
  TILE_SIDE[def.id] = def.tiles.side;
  TILE_FRONT[def.id] = def.tiles.front ?? def.tiles.side;
}

/* ------------------------------------------------------- block state helpers */

export const isWire = (id: number) => id >= B.WIRE_0 && id <= B.WIRE_15;
export const wirePower = (id: number) => (isWire(id) ? id - B.WIRE_0 : 0);
export const wireBlock = (power: number) => B.WIRE_0 + Math.max(0, Math.min(15, power));

export const isWheat = (id: number) => id >= B.WHEAT_0 && id <= B.WHEAT_7;
export const wheatStage = (id: number) => id - B.WHEAT_0;

/** Face a lever/button is attached by: 0 = floor, 1 = wall at -Z, 2 = +Z, 3 = -X, 4 = +X. */
export type AttachFace = 0 | 1 | 2 | 3 | 4;
export const isLever = (id: number) => id >= B.LEVER && id < B.LEVER + 10;
export const isButton = (id: number) => id >= B.BUTTON && id < B.BUTTON + 10;
export const switchFace = (id: number) => (((isLever(id) ? id - B.LEVER : id - B.BUTTON) >> 1) as AttachFace);
export const switchOn = (id: number) => ((isLever(id) ? id - B.LEVER : id - B.BUTTON) & 1) === 1;
export const leverBlock = (face: AttachFace, on: boolean) => B.LEVER + face * 2 + (on ? 1 : 0);
export const buttonBlock = (face: AttachFace, on: boolean) => B.BUTTON + face * 2 + (on ? 1 : 0);
/** Direction from a lever/button cell to the block it hangs on. */
export const ATTACH_DIRS: [number, number, number][] = [[0, -1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];

export const isDoor = (id: number) => id >= B.WOODEN_DOOR && id < B.IRON_DOOR + 16;
export const isIronDoor = (id: number) => id >= B.IRON_DOOR && id < B.IRON_DOOR + 16;
/** Door state: facing 0..3 (side of the cell its slab sits on: -Z, +X, +Z, -X), open, upper half. */
export function doorState(id: number) {
  const i = id - (isIronDoor(id) ? B.IRON_DOOR : B.WOODEN_DOOR);
  return { facing: i >> 2, open: ((i >> 1) & 1) === 1, upper: (i & 1) === 1, iron: isIronDoor(id) };
}
export const doorBlock = (iron: boolean, facing: number, open: boolean, upper: boolean) =>
  (iron ? B.IRON_DOOR : B.WOODEN_DOOR) + (facing & 3) * 4 + (open ? 2 : 0) + (upper ? 1 : 0);

const inRange4 = (id: number, base: number) => id >= base && id < base + 4;
/** A torch on the side of a block (any kind), and which face it hangs on (1..4, as in ATTACH_DIRS). */
export const isWallTorch = (id: number) => inRange4(id, B.WALL_TORCH) || inRange4(id, B.REDSTONE_WALL_TORCH) || inRange4(id, B.REDSTONE_WALL_TORCH_OFF);
export const wallTorchFace = (id: number) => (((id - B.WALL_TORCH) % 4) + 1) as AttachFace;
export const isRedstoneTorch = (id: number) =>
  id === B.REDSTONE_TORCH || id === B.REDSTONE_TORCH_OFF || inRange4(id, B.REDSTONE_WALL_TORCH) || inRange4(id, B.REDSTONE_WALL_TORCH_OFF);
export const isLitRedstoneTorch = (id: number) => id === B.REDSTONE_TORCH || inRange4(id, B.REDSTONE_WALL_TORCH);
/** The same redstone torch (standing or on the same wall), lit or not. */
export const redstoneTorchLit = (id: number, lit: boolean) => {
  if (!isWallTorch(id)) return lit ? B.REDSTONE_TORCH : B.REDSTONE_TORCH_OFF;
  return (lit ? B.REDSTONE_WALL_TORCH : B.REDSTONE_WALL_TORCH_OFF) + wallTorchFace(id) - 1;
};
/** A torch placed against face 0 (the floor: standing) or 1..4 (a wall). */
export function torchOn(item: number, face: AttachFace): number {
  if (face === 0) return item;
  return (item === B.REDSTONE_TORCH ? B.REDSTONE_WALL_TORCH : B.WALL_TORCH) + face - 1;
}
export const isPlate = (id: number) => id === B.PRESSURE_PLATE || id === B.PRESSURE_PLATE_ON;

/** Where a block's support lies, or null if it never needs one. */
export function supportDir(id: number): [number, number, number] | null {
  const def = defs[id];
  if (!def?.needsSupport) return null;
  if (isLever(id) || isButton(id)) return ATTACH_DIRS[switchFace(id)];
  if (isWallTorch(id)) return ATTACH_DIRS[wallTorchFace(id)];
  return [0, -1, 0];
}

/** Can `supporter` hold up `id`? Crops need farmland, plants need soil, the rest a solid block. */
export function supports(id: number, supporter: number): boolean {
  if (isWheat(id)) return supporter === B.FARMLAND;
  if (id === B.TALL_GRASS || id === B.FLOWER_RED || id === B.FLOWER_YELLOW) {
    return supporter === B.GRASS || supporter === B.DIRT || supporter === B.FARMLAND || supporter === B.SNOWY_GRASS;
  }
  if (isDoor(id) && doorState(id).upper) return isDoor(supporter) && !doorState(supporter).upper;
  // Snow settles on any full block, leaves included, but slides off ice.
  if (id === B.SNOW_LAYER) {
    const leafy = supporter === B.LEAVES || supporter === B.BIRCH_LEAVES || supporter === B.SPRUCE_LEAVES || supporter === B.JUNGLE_LEAVES;
    return supporter !== B.ICE && IS_SOLID[supporter] === 1 && (IS_OPAQUE[supporter] === 1 || leafy);
  }
  return IS_SOLID[supporter] === 1 && IS_OPAQUE[supporter] === 1;
}

/* ------------------------------------------------------------------ items */

export interface ToolDef {
  type: ToolType;
  speed: number;
  tier: number;
}

export interface ItemDef {
  id: number;
  name: string;
  /** Command name, e.g. "iron_pickaxe" for /give. */
  key: string;
  /** Present for block items. */
  block?: number;
  maxStack: number;
  tool?: ToolDef;
  /** Hunger points and saturation restored when eaten. */
  food?: { hunger: number; saturation: number };
  /** Melee damage in half-hearts (swords, and tools as improvised weapons). */
  damage?: number;
  /** Uses before the item breaks. */
  durability?: number;
  /** Wearable: which slot (0 head .. 3 feet) and how many armor points it gives. */
  armor?: { slot: ArmorSlot; points: number };
  /** Hold to draw, release to shoot. */
  bow?: boolean;
  /** Drunk like food is eaten (leaving `drink.leaves` behind), whatever the hunger level. */
  drink?: { leaves: number };
}

const items = new Map<number, ItemDef>();
const keyOf = (name: string) => name.toLowerCase().replace(/['()]/g, "").replace(/\s+/g, "_");

for (const def of defs) {
  if (!def || def.id === B.AIR || isWater(def.id) || def.noItem) continue;
  items.set(def.id, { id: def.id, name: def.name, key: keyOf(def.name), block: def.id, maxStack: 64 });
}

const item = (id: number, name: string, extra: Partial<ItemDef> = {}) =>
  items.set(id, { id, name, key: keyOf(name), maxStack: 64, ...extra });

item(I.STICK, "Stick");
item(I.COAL, "Coal");
item(I.APPLE, "Apple", { food: { hunger: 4, saturation: 2.4 } });
item(I.WOOL, "Wool");
item(I.FEATHER, "Feather");
item(I.BONE, "Bone");
item(I.STRING, "String");
item(I.ARROW, "Arrow");
item(I.FLINT, "Flint");
item(I.BOW, "Bow", { maxStack: 1, bow: true, durability: 384, damage: 1 });
item(I.IRON_HELMET, "Iron Helmet", { maxStack: 1, armor: { slot: 0, points: 2 }, durability: 165 });
item(I.IRON_CHESTPLATE, "Iron Chestplate", { maxStack: 1, armor: { slot: 1, points: 6 }, durability: 240 });
item(I.IRON_LEGGINGS, "Iron Leggings", { maxStack: 1, armor: { slot: 2, points: 5 }, durability: 225 });
item(I.IRON_BOOTS, "Iron Boots", { maxStack: 1, armor: { slot: 3, points: 2 }, durability: 195 });
item(I.IRON_INGOT, "Iron Ingot");
item(I.GOLD_INGOT, "Gold Ingot");
item(I.DIAMOND, "Diamond");
item(I.LAPIS, "Lapis Lazuli");
item(I.REDSTONE, "Redstone Dust");
item(I.CLAY_BALL, "Clay Ball");
item(I.BRICK, "Brick");
item(I.WHEAT, "Wheat");
item(I.SEEDS, "Wheat Seeds");
item(I.BUCKET, "Bucket", { maxStack: 16 });
item(I.WATER_BUCKET, "Water Bucket", { maxStack: 1 });
item(I.FISHING_ROD, "Fishing Rod", { maxStack: 1, durability: 64 });
item(I.WOODEN_DOOR, "Wooden Door");
item(I.IRON_DOOR, "Iron Door");
item(I.EGG, "Egg", { maxStack: 16 });
item(I.SNOWBALL, "Snowball", { maxStack: 16 });
item(I.MILK_BUCKET, "Milk Bucket", { maxStack: 1, drink: { leaves: I.BUCKET } });
// Food values follow the classic table (hunger points, saturation).
item(I.BREAD, "Bread", { food: { hunger: 5, saturation: 6 } });
item(I.RAW_MEAT, "Raw Beef", { food: { hunger: 3, saturation: 1.8 } });
item(I.STEAK, "Steak", { food: { hunger: 8, saturation: 12.8 } });
item(I.RAW_PORKCHOP, "Raw Porkchop", { food: { hunger: 3, saturation: 1.8 } });
item(I.COOKED_PORKCHOP, "Cooked Porkchop", { food: { hunger: 8, saturation: 12.8 } });
item(I.RAW_CHICKEN, "Raw Chicken", { food: { hunger: 2, saturation: 1.2 } });
item(I.COOKED_CHICKEN, "Cooked Chicken", { food: { hunger: 6, saturation: 7.2 } });
item(I.RAW_FISH, "Raw Fish", { food: { hunger: 2, saturation: 0.4 } });
item(I.COOKED_FISH, "Cooked Fish", { food: { hunger: 5, saturation: 6 } });

/** Tool tiers: harvest level, mining speed, durability and the damage bonus over the base. */
export const TOOL_MATERIALS = {
  wooden: { name: "Wooden", tier: 1, speed: 2, uses: 59, bonus: 0 },
  stone: { name: "Stone", tier: 2, speed: 4, uses: 131, bonus: 1 },
  iron: { name: "Iron", tier: 3, speed: 6, uses: 250, bonus: 2 },
  golden: { name: "Golden", tier: 1, speed: 12, uses: 32, bonus: 0 },
  diamond: { name: "Diamond", tier: 4, speed: 8, uses: 1561, bonus: 3 },
} as const;
export type ToolMaterial = keyof typeof TOOL_MATERIALS;
export type ToolKind = "pickaxe" | "axe" | "shovel" | "sword" | "hoe";

export const TOOL_IDS: Record<ToolMaterial, Record<ToolKind, number>> = {
  wooden: { pickaxe: I.WOODEN_PICKAXE, axe: I.WOODEN_AXE, shovel: I.WOODEN_SHOVEL, sword: I.WOODEN_SWORD, hoe: I.WOODEN_HOE },
  stone: { pickaxe: I.STONE_PICKAXE, axe: I.STONE_AXE, shovel: I.STONE_SHOVEL, sword: I.STONE_SWORD, hoe: I.STONE_HOE },
  iron: { pickaxe: I.IRON_PICKAXE, axe: I.IRON_AXE, shovel: I.IRON_SHOVEL, sword: I.IRON_SWORD, hoe: I.IRON_HOE },
  golden: { pickaxe: I.GOLDEN_PICKAXE, axe: I.GOLDEN_AXE, shovel: I.GOLDEN_SHOVEL, sword: I.GOLDEN_SWORD, hoe: I.GOLDEN_HOE },
  diamond: { pickaxe: I.DIAMOND_PICKAXE, axe: I.DIAMOND_AXE, shovel: I.DIAMOND_SHOVEL, sword: I.DIAMOND_SWORD, hoe: I.DIAMOND_HOE },
};
const BASE_DAMAGE: Record<ToolKind, number> = { sword: 4, axe: 3, pickaxe: 2, shovel: 2, hoe: 1 };
const KIND_NAME: Record<ToolKind, string> = { pickaxe: "Pickaxe", axe: "Axe", shovel: "Shovel", sword: "Sword", hoe: "Hoe" };
/** Which material and kind a tool id is, for sprites and recipes. */
export const TOOL_INFO = new Map<number, { material: ToolMaterial; kind: ToolKind }>();
for (const [material, kinds] of Object.entries(TOOL_IDS) as [ToolMaterial, Record<ToolKind, number>][]) {
  const m = TOOL_MATERIALS[material];
  for (const [kind, id] of Object.entries(kinds) as [ToolKind, number][]) {
    TOOL_INFO.set(id, { material, kind });
    item(id, `${m.name} ${KIND_NAME[kind]}`, {
      maxStack: 1,
      // Swords cut leaves a little faster but are made for fighting; hoes till soil.
      tool: { type: kind, speed: kind === "sword" ? 1.5 : kind === "hoe" ? 1 : m.speed, tier: m.tier },
      damage: BASE_DAMAGE[kind] + (kind === "hoe" ? 0 : m.bonus),
      durability: m.uses,
    });
  }
}

export const ITEMS = items;
export const getItem = (id: number) => items.get(id);
export const isBlockItem = (id: number) => id < 256 && items.get(id)?.block !== undefined;

/** Command-name lookup, with a few familiar aliases. */
const ALIASES: Record<string, number> = {
  wool: B.WOOL_WHITE, redstone: I.REDSTONE, redstone_dust: I.REDSTONE, cooked_beef: I.STEAK, beef: I.RAW_MEAT,
  raw_beef: I.RAW_MEAT, porkchop: I.RAW_PORKCHOP, chicken: I.RAW_CHICKEN, fish: I.RAW_FISH, cod: I.RAW_FISH,
  seeds: I.SEEDS, wheat_seeds: I.SEEDS, lapis: I.LAPIS, lapis_lazuli: I.LAPIS, log: B.LOG, planks: B.PLANKS,
  leaves: B.LEAVES, oak_leaves: B.LEAVES, torch: B.TORCH, water: I.WATER_BUCKET, gold: I.GOLD_INGOT, iron: I.IRON_INGOT,
  stone_button: B.BUTTON, button: B.BUTTON, lever: B.LEVER, pressure_plate: B.PRESSURE_PLATE, door: I.WOODEN_DOOR,
  oak_door: I.WOODEN_DOOR, gold_pickaxe: I.GOLDEN_PICKAXE, gold_sword: I.GOLDEN_SWORD, gold_axe: I.GOLDEN_AXE,
  gold_shovel: I.GOLDEN_SHOVEL, gold_hoe: I.GOLDEN_HOE,
};
export function itemByKey(key: string): number | null {
  const k = key.toLowerCase().replace(/^minecraft:/, "");
  if (k in ALIASES) return ALIASES[k];
  for (const it of items.values()) if (it.key === k) return it.id;
  return null;
}

/** Items shown in the creative palette, in display order. */
export const CREATIVE_ITEMS: number[] = [
  // Natural
  B.GRASS, B.DIRT, B.STONE, B.COBBLESTONE, B.SAND, B.GRAVEL, B.SANDSTONE, B.CLAY, B.OBSIDIAN,
  B.LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.JUNGLE_LOG, B.LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES, B.JUNGLE_LEAVES, B.BEDROCK,
  B.PLANKS, B.BRICKS, B.GLASS, B.SNOW, B.SNOW_LAYER, B.ICE, B.TALL_GRASS, B.FLOWER_YELLOW, B.FLOWER_RED, B.SNOWY_GRASS,
  B.WOOL_WHITE, B.WOOL_LIGHT_GRAY, B.WOOL_GRAY, B.WOOL_BLACK, B.WOOL_BROWN, B.WOOL_PINK, B.CRAFTING_TABLE, B.FURNACE, B.TORCH,
  // Ores and minerals
  B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.LAPIS_ORE, B.REDSTONE_ORE, I.COAL, I.IRON_INGOT, I.GOLD_INGOT,
  I.DIAMOND, I.LAPIS, I.REDSTONE, I.CLAY_BALL, I.BRICK, I.FLINT, I.STICK, I.STRING, I.FEATHER,
  // Redstone
  B.REDSTONE_TORCH, B.LEVER, B.BUTTON, B.PRESSURE_PLATE, I.WOODEN_DOOR, I.IRON_DOOR, I.BONE, I.BUCKET, I.WATER_BUCKET, I.MILK_BUCKET,
  // Tools and weapons
  ...(["wooden", "stone", "iron", "golden", "diamond"] as ToolMaterial[]).flatMap((m) => [TOOL_IDS[m].pickaxe, TOOL_IDS[m].shovel, TOOL_IDS[m].axe, TOOL_IDS[m].hoe, TOOL_IDS[m].sword]),
  I.BOW, I.ARROW, I.FISHING_ROD, I.IRON_HELMET, I.IRON_CHESTPLATE, I.IRON_LEGGINGS, I.IRON_BOOTS,
  // Food and farming
  I.SEEDS, I.WHEAT, I.BREAD, I.APPLE, I.RAW_PORKCHOP, I.COOKED_PORKCHOP, I.RAW_MEAT, I.STEAK, I.RAW_CHICKEN,
  I.COOKED_CHICKEN, I.RAW_FISH, I.COOKED_FISH, I.EGG, I.SNOWBALL,
];

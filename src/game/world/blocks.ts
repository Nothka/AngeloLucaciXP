/**
 * Block and item registry. Pure data (no DOM) so the mesher worker can import it.
 * Block ids double as item ids for their block item; non-block items start at 256.
 */

export const TILE_NAMES = [
  "grass_top",
  "grass_side",
  "dirt",
  "stone",
  "cobblestone",
  "sand",
  "sandstone_top",
  "sandstone_side",
  "sandstone_bottom",
  "log_side",
  "log_top",
  "leaves",
  "planks",
  "glass",
  "water",
  "coal_ore",
  "torch",
  "crafting_table_top",
  "crafting_table_side",
  "crafting_table_front",
  "bedrock",
  "tall_grass",
  "flower_yellow",
  "flower_red",
  "snow",
  "grass_side_snow",
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
  /** Flowing water, by level: 3 = full block, 2 = half, 1 = a thin film. */
  WATER_FLOW_1 = 21,
  WATER_FLOW_2 = 22,
  WATER_FLOW_3 = 23,
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
  WOOL = 267,
  FEATHER = 268,
  RAW_MEAT = 269,
  BONE = 270,
  STRING = 271,
  ARROW = 272,
  BOW = 273,
  IRON_HELMET = 274,
  IRON_CHESTPLATE = 275,
  IRON_LEGGINGS = 276,
  IRON_BOOTS = 277,
}

/** Armor slots, top to bottom. */
export type ArmorSlot = 0 | 1 | 2 | 3;

export type Shape = "none" | "cube" | "cross" | "torch" | "liquid";
export type RenderPass = "opaque" | "cutout" | "water";
export type ToolType = "pickaxe" | "axe" | "shovel" | "sword";
export type SoundKind = "grass" | "stone" | "wood" | "sand" | "glass" | "cloth" | "none";

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
  /** Item dropped when harvested; null drops nothing. */
  drop: number | null;
  sound: SoundKind;
  /** Can be overwritten by placing a block into it. */
  replaceable: boolean;
  /** Needs a solid block underneath, otherwise it pops off. */
  needsSupport: boolean;
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
  drop: null,
  sound: "stone",
  replaceable: false,
  needsSupport: false,
};

const defs: BlockDef[] = [];
const define = (id: number, name: string, tiles: BlockDef["tiles"], props: Partial<BlockDef> = {}) => {
  defs[id] = { ...defaults, id, name, tiles, drop: id, ...props };
};

define(B.AIR, "Air", all(0), {
  shape: "none", solid: false, opaque: false, lightOpacity: 0, hardness: 0, drop: null, sound: "none", replaceable: true,
});
define(B.GRASS, "Grass Block", { top: TILE.grass_top, bottom: TILE.dirt, side: TILE.grass_side }, {
  hardness: 0.6, tool: "shovel", drop: B.DIRT, sound: "grass",
});
define(B.DIRT, "Dirt", all(TILE.dirt), { hardness: 0.5, tool: "shovel", sound: "grass" });
define(B.STONE, "Stone", all(TILE.stone), { hardness: 1.5, tool: "pickaxe", needsTool: true, drop: B.COBBLESTONE });
define(B.COBBLESTONE, "Cobblestone", all(TILE.cobblestone), { hardness: 2, tool: "pickaxe", needsTool: true });
define(B.SAND, "Sand", all(TILE.sand), { hardness: 0.5, tool: "shovel", sound: "sand" });
define(B.SANDSTONE, "Sandstone", { top: TILE.sandstone_top, bottom: TILE.sandstone_bottom, side: TILE.sandstone_side }, {
  hardness: 0.8, tool: "pickaxe", needsTool: true,
});
define(B.LOG, "Oak Log", { top: TILE.log_top, bottom: TILE.log_top, side: TILE.log_side }, {
  hardness: 2, tool: "axe", sound: "wood",
});
define(B.LEAVES, "Leaves", all(TILE.leaves), {
  pass: "cutout", opaque: false, lightOpacity: 1, hardness: 0.2, sound: "grass", drop: null, tool: "sword",
});
define(B.PLANKS, "Oak Planks", all(TILE.planks), { hardness: 2, tool: "axe", sound: "wood" });
define(B.GLASS, "Glass", all(TILE.glass), {
  pass: "cutout", opaque: false, lightOpacity: 0, hardness: 0.3, sound: "glass", drop: null,
});
define(B.WATER, "Water", all(TILE.water), {
  shape: "liquid", pass: "water", solid: false, opaque: false, lightOpacity: 2, hardness: -1, drop: null,
  sound: "none", replaceable: true,
});
define(B.COAL_ORE, "Coal Ore", all(TILE.coal_ore), {
  hardness: 3, tool: "pickaxe", needsTool: true, drop: I.COAL,
});
define(B.TORCH, "Torch", all(TILE.torch), {
  shape: "torch", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, emit: 14, hardness: 0,
  sound: "wood", needsSupport: true,
});
define(B.CRAFTING_TABLE, "Crafting Table", {
  top: TILE.crafting_table_top, bottom: TILE.planks, side: TILE.crafting_table_side, front: TILE.crafting_table_front,
}, { hardness: 2.5, tool: "axe", sound: "wood" });
define(B.BEDROCK, "Bedrock", all(TILE.bedrock), { hardness: -1, drop: null });
define(B.TALL_GRASS, "Tall Grass", all(TILE.tall_grass), {
  shape: "cross", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0, drop: null,
  sound: "grass", replaceable: true, needsSupport: true,
});
define(B.FLOWER_YELLOW, "Dandelion", all(TILE.flower_yellow), {
  shape: "cross", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0,
  sound: "grass", needsSupport: true,
});
define(B.FLOWER_RED, "Poppy", all(TILE.flower_red), {
  shape: "cross", pass: "cutout", solid: false, opaque: false, lightOpacity: 0, hardness: 0,
  sound: "grass", needsSupport: true,
});
define(B.SNOWY_GRASS, "Snowy Grass", { top: TILE.snow, bottom: TILE.dirt, side: TILE.grass_side_snow }, {
  hardness: 0.6, tool: "shovel", drop: B.DIRT, sound: "cloth",
});
define(B.SNOW, "Snow Block", all(TILE.snow), { hardness: 0.2, tool: "shovel", sound: "cloth" });
for (const [id, level] of [[B.WATER_FLOW_1, 1], [B.WATER_FLOW_2, 2], [B.WATER_FLOW_3, 3]] as const) {
  define(id, `Flowing Water (${level})`, all(TILE.water), {
    shape: "liquid", pass: "water", solid: false, opaque: false, lightOpacity: 2, hardness: -1, drop: null,
    sound: "none", replaceable: true,
  });
}

export const BLOCKS = defs;
export const BLOCK_COUNT = defs.length;

// Flat lookup tables for the hot loops in lighting and meshing.
export const IS_OPAQUE = new Uint8Array(256);
export const IS_SOLID = new Uint8Array(256);
export const LIGHT_OPACITY = new Uint8Array(256);
export const EMIT = new Uint8Array(256);
export const SHAPE_CODE = new Uint8Array(256); // 0 none, 1 cube, 2 cross, 3 torch, 4 liquid
export const PASS_CODE = new Uint8Array(256); // 0 opaque, 1 cutout, 2 water
export const TILE_TOP = new Uint8Array(256);
export const TILE_BOTTOM = new Uint8Array(256);
export const TILE_SIDE = new Uint8Array(256);
export const TILE_FRONT = new Uint8Array(256);

/** 4 = source, 3..1 = flowing levels, 0 = not water. */
export const FLUID_LEVEL = new Uint8Array(256);
FLUID_LEVEL[B.WATER] = 4;
FLUID_LEVEL[B.WATER_FLOW_3] = 3;
FLUID_LEVEL[B.WATER_FLOW_2] = 2;
FLUID_LEVEL[B.WATER_FLOW_1] = 1;
export const FLOW_BLOCK = [B.AIR, B.WATER_FLOW_1, B.WATER_FLOW_2, B.WATER_FLOW_3, B.WATER];
export const isWater = (id: number) => FLUID_LEVEL[id] > 0;

/**
 * Height of a water cell's surface in 1/16 block units: sources and level 3
 * are full, level 2 is half, level 1 a thin film. Water with water above it
 * is always full so falling columns stay seamless.
 */
export function waterHeight16(id: number, above: number): number {
  const level = FLUID_LEVEL[id];
  if (!level) return 0;
  if (FLUID_LEVEL[above]) return 16;
  return level >= 3 ? 16 : level === 2 ? 8 : 3;
}

const SHAPES: Shape[] = ["none", "cube", "cross", "torch", "liquid"];
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

/* ------------------------------------------------------------------ items */

export interface ToolDef {
  type: ToolType;
  speed: number;
  tier: number;
}

export interface ItemDef {
  id: number;
  name: string;
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
}

const items = new Map<number, ItemDef>();

for (const def of defs) {
  if (!def || def.id === B.AIR || isWater(def.id)) continue;
  items.set(def.id, { id: def.id, name: def.name, block: def.id, maxStack: 64 });
}

const item = (id: number, name: string, extra: Partial<ItemDef> = {}) =>
  items.set(id, { id, name, maxStack: 64, ...extra });

item(I.STICK, "Stick");
item(I.APPLE, "Apple", { food: { hunger: 4, saturation: 2.4 } });
item(I.WOOL, "Wool");
item(I.FEATHER, "Feather");
item(I.RAW_MEAT, "Raw Meat", { food: { hunger: 3, saturation: 1.8 } });
item(I.BONE, "Bone");
item(I.STRING, "String");
item(I.ARROW, "Arrow");
item(I.BOW, "Bow", { maxStack: 1, bow: true, durability: 384, damage: 1 });
item(I.IRON_HELMET, "Iron Helmet", { maxStack: 1, armor: { slot: 0, points: 2 }, durability: 165 });
item(I.IRON_CHESTPLATE, "Iron Chestplate", { maxStack: 1, armor: { slot: 1, points: 6 }, durability: 240 });
item(I.IRON_LEGGINGS, "Iron Leggings", { maxStack: 1, armor: { slot: 2, points: 5 }, durability: 225 });
item(I.IRON_BOOTS, "Iron Boots", { maxStack: 1, armor: { slot: 3, points: 2 }, durability: 195 });
item(I.COAL, "Coal");
const WOOD_USES = 60;
const STONE_USES = 130;
item(I.WOODEN_PICKAXE, "Wooden Pickaxe", { maxStack: 1, tool: { type: "pickaxe", speed: 2, tier: 1 }, damage: 2, durability: WOOD_USES });
item(I.STONE_PICKAXE, "Stone Pickaxe", { maxStack: 1, tool: { type: "pickaxe", speed: 4, tier: 2 }, damage: 3, durability: STONE_USES });
item(I.WOODEN_AXE, "Wooden Axe", { maxStack: 1, tool: { type: "axe", speed: 2, tier: 1 }, damage: 3, durability: WOOD_USES });
item(I.STONE_AXE, "Stone Axe", { maxStack: 1, tool: { type: "axe", speed: 4, tier: 2 }, damage: 4, durability: STONE_USES });
item(I.WOODEN_SHOVEL, "Wooden Shovel", { maxStack: 1, tool: { type: "shovel", speed: 2, tier: 1 }, damage: 2, durability: WOOD_USES });
item(I.STONE_SHOVEL, "Stone Shovel", { maxStack: 1, tool: { type: "shovel", speed: 4, tier: 2 }, damage: 3, durability: STONE_USES });
// Swords cut leaves a little faster but are made for fighting.
item(I.WOODEN_SWORD, "Wooden Sword", { maxStack: 1, tool: { type: "sword", speed: 1.5, tier: 1 }, damage: 4, durability: WOOD_USES });
item(I.STONE_SWORD, "Stone Sword", { maxStack: 1, tool: { type: "sword", speed: 1.5, tier: 2 }, damage: 5, durability: STONE_USES });

export const ITEMS = items;
export const getItem = (id: number) => items.get(id);
export const isBlockItem = (id: number) => id < 256 && items.get(id)?.block !== undefined;

/** Items shown in the creative palette, in display order. */
export const CREATIVE_ITEMS: number[] = [
  B.GRASS, B.DIRT, B.STONE, B.COBBLESTONE, B.SAND, B.SANDSTONE, B.LOG, B.PLANKS, B.LEAVES,
  B.GLASS, B.COAL_ORE, B.CRAFTING_TABLE, B.TORCH, B.SNOW, B.BEDROCK, B.TALL_GRASS,
  B.FLOWER_YELLOW, B.FLOWER_RED, I.STICK, I.COAL, I.WOODEN_PICKAXE, I.STONE_PICKAXE,
  I.WOODEN_AXE, I.STONE_AXE, I.WOODEN_SHOVEL, I.STONE_SHOVEL, I.WOODEN_SWORD, I.STONE_SWORD, I.APPLE,
  I.WOOL, I.FEATHER, I.RAW_MEAT, I.BONE, I.STRING, I.ARROW, I.BOW,
  I.IRON_HELMET, I.IRON_CHESTPLATE, I.IRON_LEGGINGS, I.IRON_BOOTS,
];

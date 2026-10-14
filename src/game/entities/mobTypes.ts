import { B, I } from "../world/blocks";

export type MobType = "sheep" | "pig" | "chicken" | "cow" | "zombie" | "skeleton" | "spider";
export type SpawnCategory = "creature" | "monster";

export interface DropRule {
  item: number;
  min: number;
  max: number;
  /** Chance that this rule drops anything at all (default 1). */
  chance?: number;
  /** Pick one of these instead of `item`. */
  oneOf?: number[];
}

export interface MobDef {
  type: MobType;
  name: string;
  maxHealth: number;
  /** Walking speed in blocks per second. */
  speed: number;
  category: SpawnCategory;
  /** Relative chance when a pack picks its type. */
  weight: number;
  group: [number, number];
  /** Collision box: footprint width and height, in blocks. */
  width: number;
  height: number;
  drops: DropRule[];
  /** Items that make it fall in love (and follow a player holding them). */
  breedFood?: number[];
  /** Melee damage (half-hearts) for hostile mobs. */
  attack?: number;
  /** Keeps its distance and shoots arrows instead of meleeing. */
  ranged?: boolean;
  /** Catches fire in direct sunlight. */
  burns?: boolean;
  /** Climbs walls it walks into. */
  climbs?: boolean;
  /** Ignores the player in daylight unless provoked. */
  neutralInDay?: boolean;
  /** Experience dropped when killed by the player: [min, max]. */
  xp: [number, number];
}

export const MOB_TYPES: Record<MobType, MobDef> = {
  sheep: {
    type: "sheep", name: "Sheep", maxHealth: 8, speed: 1.1, category: "creature", weight: 12, group: [2, 4],
    width: 0.9, height: 1.3, drops: [{ item: B.WOOL_WHITE, min: 1, max: 1 }], breedFood: [I.WHEAT], xp: [1, 3],
  },
  pig: {
    type: "pig", name: "Pig", maxHealth: 10, speed: 1.1, category: "creature", weight: 10, group: [2, 4],
    width: 0.9, height: 0.9, drops: [{ item: I.RAW_PORKCHOP, min: 1, max: 3 }], breedFood: [I.WHEAT], xp: [1, 3],
  },
  chicken: {
    type: "chicken", name: "Chicken", maxHealth: 4, speed: 1.0, category: "creature", weight: 10, group: [2, 4],
    width: 0.45, height: 0.75, drops: [{ item: I.RAW_CHICKEN, min: 1, max: 1 }, { item: I.FEATHER, min: 0, max: 2 }], breedFood: [I.SEEDS], xp: [1, 3],
  },
  cow: {
    type: "cow", name: "Cow", maxHealth: 10, speed: 1.0, category: "creature", weight: 8, group: [2, 4],
    width: 0.9, height: 1.4, drops: [{ item: I.RAW_MEAT, min: 1, max: 3 }], breedFood: [I.WHEAT], xp: [1, 3],
  },
  zombie: {
    type: "zombie", name: "Shambler", maxHealth: 20, speed: 2.3, category: "monster", weight: 100, group: [1, 4],
    width: 0.6, height: 1.95, drops: [], attack: 3, burns: true, xp: [5, 5],
  },
  skeleton: {
    type: "skeleton", name: "Rattler", maxHealth: 20, speed: 2.5, category: "monster", weight: 80, group: [1, 4],
    width: 0.6, height: 1.95,
    drops: [
      { item: I.BONE, min: 0, max: 2 },
      { item: I.ARROW, min: 0, max: 2 },
      // Now and then a piece of the armour it was buried in.
      { item: I.IRON_HELMET, min: 1, max: 1, chance: 0.06, oneOf: [I.IRON_HELMET, I.IRON_CHESTPLATE, I.IRON_LEGGINGS, I.IRON_BOOTS] },
    ],
    attack: 2, ranged: true, burns: true, xp: [5, 5],
  },
  spider: {
    type: "spider", name: "Creepcrawler", maxHealth: 16, speed: 3, category: "monster", weight: 90, group: [1, 3],
    width: 1.3, height: 0.9, drops: [{ item: I.STRING, min: 0, max: 2 }], attack: 2,
    climbs: true, neutralInDay: true, xp: [5, 5],
  },
};

export const MOB_LIST = Object.values(MOB_TYPES);
export const typesIn = (category: SpawnCategory) => MOB_LIST.filter((m) => m.category === category);

/**
 * Sheep fleece colours (RGB 0..1) with their spawn chances. White takes
 * whatever the others leave, so the table always sums to 1.
 */
const RARE_SHEEP: { name: string; rgb: [number, number, number]; chance: number }[] = [
  { name: "black", rgb: [0.12, 0.11, 0.12], chance: 0.0475 },
  { name: "gray", rgb: [0.42, 0.42, 0.44], chance: 0.0475 },
  { name: "light_gray", rgb: [0.68, 0.68, 0.7], chance: 0.0475 },
  { name: "brown", rgb: [0.48, 0.32, 0.2], chance: 0.0285 },
  { name: "pink", rgb: [0.95, 0.62, 0.72], chance: 0.0016 },
];
export const SHEEP_COLORS = [
  { name: "white", rgb: [1, 1, 1] as [number, number, number], chance: 1 - RARE_SHEEP.reduce((a, c) => a + c.chance, 0) },
  ...RARE_SHEEP,
];
const WOOL_BY_NAME: Record<string, number> = {
  white: B.WOOL_WHITE, black: B.WOOL_BLACK, gray: B.WOOL_GRAY, light_gray: B.WOOL_LIGHT_GRAY, brown: B.WOOL_BROWN, pink: B.WOOL_PINK,
};
/** The wool block a sheep of this colour index drops. */
export const woolFor = (color: number) => WOOL_BY_NAME[SHEEP_COLORS[color]?.name ?? "white"] ?? B.WOOL_WHITE;
export const LAMB_CHANCE = 0.05;

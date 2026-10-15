import { B, I, TILE } from "../world/blocks";

/** What has to happen, and how many times, for an achievement to unlock. */
export type Trigger =
  | { type: "joined" }
  | { type: "break"; ids: number[]; count?: number; harvested?: boolean }
  | { type: "place"; ids?: number[]; count?: number }
  | { type: "craft"; ids: number[]; count?: number }
  | { type: "pickup"; ids: number[]; count?: number }
  | { type: "eat"; ids?: number[] }
  | { type: "water" }
  | { type: "day"; count?: number }
  | { type: "above"; y: number }
  | { type: "below"; y: number }
  | { type: "respawn" }
  | { type: "kill"; hostile?: boolean; weaponTool?: "sword" }
  | { type: "flock" }
  | { type: "breed" }
  | { type: "nightSurvived" };

/** Node icon: an item's inventory icon, or a raw texture tile. */
export type AchievementIcon = { item: number } | { tile: number };

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: AchievementIcon;
  parentId: string | null;
  trigger: Trigger;
  /** Shown only once earned. */
  hidden?: boolean;
  /** Harder goal: spiky frame and its own toast colour. */
  challenge?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "start", title: "Fresh Start", description: "Step into a new world", icon: { item: B.GRASS }, parentId: null, trigger: { type: "joined" } },

  // Woodworking
  { id: "timber", title: "Timber!", description: "Chop down a log", icon: { item: B.LOG }, parentId: "start", trigger: { type: "break", ids: [B.LOG] } },
  { id: "planks", title: "Plank You", description: "Turn a log into planks", icon: { item: B.PLANKS }, parentId: "timber", trigger: { type: "craft", ids: [B.PLANKS] } },
  { id: "workshop", title: "Workshop", description: "Build a crafting table", icon: { item: B.CRAFTING_TABLE }, parentId: "planks", trigger: { type: "craft", ids: [B.CRAFTING_TABLE] } },
  { id: "sticks", title: "Stick Around", description: "Craft some sticks", icon: { item: I.STICK }, parentId: "planks", trigger: { type: "craft", ids: [I.STICK] } },
  { id: "wood_sword", title: "Splinters", description: "Craft a wooden sword", icon: { item: I.WOODEN_SWORD }, parentId: "workshop", trigger: { type: "craft", ids: [I.WOODEN_SWORD] } },
  { id: "stone_sword", title: "Sharper Edges", description: "Craft a stone sword", icon: { item: I.STONE_SWORD }, parentId: "wood_sword", trigger: { type: "craft", ids: [I.STONE_SWORD] } },
  { id: "tool_time", title: "Tool Time", description: "Craft a wooden pickaxe", icon: { item: I.WOODEN_PICKAXE }, parentId: "workshop", trigger: { type: "craft", ids: [I.WOODEN_PICKAXE] } },

  // Mining
  { id: "rock_bottom", title: "Rock Bottom", description: "Mine stone with a pickaxe", icon: { item: B.COBBLESTONE }, parentId: "tool_time", trigger: { type: "break", ids: [B.STONE], harvested: true } },
  { id: "upgrade", title: "Upgrade Path", description: "Craft a stone pickaxe", icon: { item: I.STONE_PICKAXE }, parentId: "rock_bottom", trigger: { type: "craft", ids: [I.STONE_PICKAXE] } },
  { id: "deep", title: "Digging Deep", description: "Go below height 20", icon: { item: B.BEDROCK }, parentId: "rock_bottom", trigger: { type: "below", y: 20 } },
  { id: "coal", title: "Black Gold", description: "Collect a piece of coal", icon: { item: I.COAL }, parentId: "rock_bottom", trigger: { type: "pickup", ids: [I.COAL] } },
  { id: "torch", title: "Let There Be Light", description: "Place a torch", icon: { item: B.TORCH }, parentId: "coal", trigger: { type: "place", ids: [B.TORCH] } },
  { id: "torches", title: "Night Shift", description: "Place 25 torches", icon: { item: B.TORCH }, parentId: "torch", trigger: { type: "place", ids: [B.TORCH], count: 25 }, challenge: true },

  // Building
  { id: "furnace", title: "Hot Topic", description: "Build a furnace out of eight cobblestone", icon: { item: B.FURNACE }, parentId: "upgrade", trigger: { type: "craft", ids: [B.FURNACE] } },
  { id: "iron", title: "Acquire Hardware", description: "Smelt an iron ingot", icon: { item: I.IRON_INGOT }, parentId: "furnace", trigger: { type: "craft", ids: [I.IRON_INGOT] } },
  { id: "bucket", title: "Pail Rider", description: "Fill a bucket with water", icon: { item: I.WATER_BUCKET }, parentId: "iron", trigger: { type: "pickup", ids: [I.WATER_BUCKET] } },
  { id: "diamond", title: "Diamonds!", description: "Mine a diamond with an iron pickaxe", icon: { item: I.DIAMOND }, parentId: "iron", trigger: { type: "pickup", ids: [I.DIAMOND] }, challenge: true },
  { id: "redstone", title: "Red Alert", description: "Mine redstone dust", icon: { item: I.REDSTONE }, parentId: "iron", trigger: { type: "pickup", ids: [I.REDSTONE] } },
  { id: "seeds", title: "Green Thumb", description: "Gather seeds from the grass", icon: { item: I.SEEDS }, parentId: "start", trigger: { type: "pickup", ids: [I.SEEDS] } },
  { id: "bread", title: "Bake Bread", description: "Turn wheat into bread", icon: { item: I.BREAD }, parentId: "seeds", trigger: { type: "craft", ids: [I.BREAD] } },
  { id: "builder", title: "Foundations", description: "Place 10 blocks", icon: { item: B.COBBLESTONE }, parentId: "start", trigger: { type: "place", count: 10 } },
  { id: "master_builder", title: "Master Builder", description: "Place 500 blocks", icon: { item: B.PLANKS }, parentId: "builder", trigger: { type: "place", count: 500 }, challenge: true },
  { id: "sand", title: "Beach Comber", description: "Collect sand", icon: { item: B.SAND }, parentId: "builder", trigger: { type: "pickup", ids: [B.SAND] } },
  { id: "glass", title: "Clear Thinking", description: "Smelt sand into glass", icon: { item: B.GLASS }, parentId: "sand", trigger: { type: "craft", ids: [B.GLASS] } },

  // Exploring
  { id: "swim", title: "Making a Splash", description: "Go for your first swim", icon: { tile: TILE.water }, parentId: "start", trigger: { type: "water" } },
  { id: "apple", title: "Forest Snack", description: "Eat an apple", icon: { item: I.APPLE }, parentId: "start", trigger: { type: "eat" } },
  { id: "day", title: "Night Owl", description: "See a full day and night go by", icon: { item: B.TORCH }, parentId: "start", trigger: { type: "day" } },
  { id: "peak", title: "Peak Performance", description: "Stand above height 100", icon: { item: B.SNOW }, parentId: "day", trigger: { type: "above", y: 100 }, challenge: true },
  // Creatures
  { id: "slayer", title: "Monster Slayer", description: "Defeat a hostile mob with a sword", icon: { item: I.STONE_SWORD }, parentId: "wood_sword", trigger: { type: "kill", hostile: true, weaponTool: "sword" } },
  { id: "flock", title: "Flock Finder", description: "Find a flock of three or more sheep", icon: { item: B.WOOL_WHITE }, parentId: "start", trigger: { type: "flock" } },
  { id: "breed", title: "Repopulation", description: "Breed two animals with wheat or seeds", icon: { item: I.WHEAT }, parentId: "flock", trigger: { type: "breed" } },
  { id: "first_night", title: "First Light", description: "Survive your first night", icon: { item: B.TORCH }, parentId: "start", trigger: { type: "nightSurvived" } },
  { id: "respawn", title: "Back on Your Feet", description: "Respawn after a fall from grace", icon: { item: I.APPLE }, parentId: "start", trigger: { type: "respawn" }, hidden: true },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export const requiredCount = (def: AchievementDef) => ("count" in def.trigger && def.trigger.count) || 1;

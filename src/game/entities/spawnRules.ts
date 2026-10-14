import { CHUNK_HEIGHT, CHUNK_SIZE, DAY_TICKS } from "../config";
import { hash2, mulberry32, smoothstep } from "../noise";
import { B, BLOCKS, IS_OPAQUE, IS_SOLID, isWater } from "../world/blocks";
import { LAMB_CHANCE, SHEEP_COLORS, typesIn, type MobDef, type MobType } from "./mobTypes";
import { SPAWN_CONFIG } from "./spawnConfig";

/**
 * Spawn and despawn rules as pure functions: no rendering, no chunk storage,
 * just numbers and block lookups, so every rule can be unit-tested.
 */

export type BlockAt = (x: number, y: number, z: number) => number;

export interface SpawnRecord {
  type: MobType;
  x: number;
  y: number;
  z: number;
  yaw: number;
  color: number;
  baby: boolean;
}

/* ----------------------------------------------------------------- helpers */

/** Deterministic RNG for one chunk of one world. */
export function chunkRandom(seed: number, cx: number, cz: number) {
  return mulberry32(Math.floor(hash2(seed ^ 0x51ed, cx, cz) * 4294967296));
}

/** Integer in [-spread, spread], peaked at 0 (difference of two uniforms). */
export function triangular(rng: () => number, spread: number) {
  return Math.floor(rng() * (spread + 1)) - Math.floor(rng() * (spread + 1));
}

export function pickWeighted<T extends { weight: number }>(rng: () => number, list: T[]): T {
  const total = list.reduce((a, b) => a + b.weight, 0);
  let r = rng() * total;
  for (const item of list) {
    r -= item.weight;
    if (r < 0) return item;
  }
  return list[list.length - 1];
}

export function packSize(rng: () => number, def: MobDef) {
  const [min, max] = def.group;
  return Math.min(SPAWN_CONFIG.maxPackSize, min + Math.floor(rng() * (max - min + 1)));
}

export function rollSheepColor(rng: () => number) {
  let r = rng();
  for (let i = 0; i < SHEEP_COLORS.length; i++) {
    r -= SHEEP_COLORS[i].chance;
    if (r < 0) return i;
  }
  return 0;
}

/** Room for a body: no collision, no water, no leaves. Plants and flowers are fine. */
export function isFree(id: number) {
  return !IS_SOLID[id] && !isWater(id) && id !== B.LEAVES;
}

/** Y of the highest block that is not air or a plant, or -1. */
export function topBlockY(blockAt: BlockAt, x: number, z: number) {
  for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
    const id = blockAt(x, y, z);
    if (id === B.AIR) continue;
    const def = BLOCKS[id];
    if (def && !def.solid && !isWater(id) && def.shape !== "liquid" && id !== B.LEAVES) continue;
    return y;
  }
  return -1;
}

/** Animals stand on grass with two free blocks above. */
export function isAnimalSpot(blockAt: BlockAt, x: number, groundY: number, z: number) {
  if (groundY < 0 || groundY + 2 >= CHUNK_HEIGHT) return false;
  if (blockAt(x, groundY, z) !== B.GRASS) return false;
  return isFree(blockAt(x, groundY + 1, z)) && isFree(blockAt(x, groundY + 2, z));
}

/* ---------------------------------------------------- chunk-generation packs */

/**
 * Animals placed when a chunk is generated for the first time. `blockAt`
 * takes chunk-local coordinates; results are chunk-local too (feet centred
 * in the block). Same seed and chunk always give the same animals.
 */
export function seededChunkAnimals(seed: number, cx: number, cz: number, blockAt: BlockAt): SpawnRecord[] {
  const rng = chunkRandom(seed, cx, cz);
  const types = typesIn("creature");
  const out: SpawnRecord[] = [];
  const spread = SPAWN_CONFIG.packSpread;
  while (rng() < SPAWN_CONFIG.chunkGenChance) {
    const def = pickWeighted(rng, types);
    const size = packSize(rng, def);
    const centerX = Math.floor(rng() * CHUNK_SIZE);
    const centerZ = Math.floor(rng() * CHUNK_SIZE);
    for (let m = 0; m < size; m++) {
      for (let attempt = 0; attempt < SPAWN_CONFIG.memberAttempts; attempt++) {
        const x = centerX + triangular(rng, spread);
        const z = centerZ + triangular(rng, spread);
        if (x < 0 || z < 0 || x >= CHUNK_SIZE || z >= CHUNK_SIZE) continue;
        const ground = topBlockY(blockAt, x, z);
        if (!isAnimalSpot(blockAt, x, ground, z)) continue;
        if (out.some((o) => o.x === x + 0.5 && o.z === z + 0.5)) continue;
        out.push({
          type: def.type,
          x: x + 0.5,
          y: ground + 1,
          z: z + 0.5,
          yaw: rng() * Math.PI * 2,
          // Colour and lamb rolls happen for every type so the RNG stream stays aligned.
          color: def.type === "sheep" ? rollSheepColor(rng) : (rng(), 0),
          baby: rng() < LAMB_CHANCE && def.type === "sheep",
        });
        break;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------ light rules */

/** How much the night takes off sky light: 0 at full day, 11 at full night. */
export function skyDarkening(timeTicks: number) {
  const t = (((timeTicks % DAY_TICKS) + DAY_TICKS) % DAY_TICKS) / DAY_TICKS;
  const day = smoothstep(-0.18, 0.28, Math.sin(t * Math.PI * 2));
  return Math.round(SPAWN_CONFIG.nightSkyDarkening * (1 - day));
}

export const internalSkyLight = (skyLight: number, timeTicks: number) => Math.max(0, skyLight - skyDarkening(timeTicks));

/** Hostiles need total darkness from blocks and a dim (internal) sky. */
export function canSpawnHostile(blockLight: number, skyLight: number, timeTicks: number) {
  return blockLight === 0 && internalSkyLight(skyLight, timeTicks) <= SPAWN_CONFIG.hostileMaxSkyLight;
}

/** Animals need daylight access, or enough block light where the sky can't reach. */
export function canSpawnPassive(blockLight: number, skyLight: number) {
  return skyLight >= SPAWN_CONFIG.passiveMinBlockLight || blockLight >= SPAWN_CONFIG.passiveMinBlockLight;
}

/* ---------------------------------------------------------- caps, despawn */

/** Cap scaled to how many chunks around the player are loaded (289 = 17x17). */
export function scaledCap(base: number, chunks: number) {
  return Math.floor((base * chunks) / SPAWN_CONFIG.capReferenceChunks);
}

/** A hostile spawn position: solid floor, two free blocks, no water. */
export function isHostileSpot(blockAt: BlockAt, x: number, y: number, z: number) {
  if (y < 1 || y + 1 >= CHUNK_HEIGHT) return false;
  const below = blockAt(x, y - 1, z);
  return IS_SOLID[below] === 1 && IS_OPAQUE[below] === 1 && isFree(blockAt(x, y, z)) && isFree(blockAt(x, y + 1, z));
}

export interface DespawnInput {
  persistent: boolean;
  /** Distance to the player in blocks. */
  distance: number;
  /** Seconds this mob has been beyond the random-despawn distance. */
  farSeconds: number;
  /** A uniform random number for this tick. */
  roll: number;
}

/** Per-tick despawn decision. Persistent mobs never despawn. */
export function shouldDespawn({ persistent, distance, farSeconds, roll }: DespawnInput) {
  if (persistent) return false;
  if (distance > SPAWN_CONFIG.despawnInstantDistance) return true;
  return distance > SPAWN_CONFIG.despawnRandomDistance && farSeconds >= SPAWN_CONFIG.despawnFarSeconds && roll < SPAWN_CONFIG.despawnChancePerTick;
}

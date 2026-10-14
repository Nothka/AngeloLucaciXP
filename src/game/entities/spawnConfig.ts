/**
 * Every tunable number for mobs, spawning and despawning. Times are in game
 * ticks (20 per second) unless the name says otherwise.
 */
export const SPAWN_CONFIG = {
  /** Chunk generation: chance of a first pack, and of each further pack. */
  chunkGenChance: 0.1,
  /** Members of a pack land within +/- this many blocks of its centre. */
  packSpread: 5,
  /** Position attempts per pack member. */
  memberAttempts: 4,

  /** Spawning only happens in chunks whose centre is this close (horizontally). */
  spawnChunkRadius: 128,
  /** ...and only inside this sphere around the player. */
  spawnSphereRadius: 128,
  /** No spawns closer than this to the player. */
  minPlayerDistance: 24,

  /** Passive spawn cycle period. */
  passiveIntervalTicks: 400,
  /** Hostile cycle runs every tick but only visits this many chunks per tick. */
  hostileChunksPerTick: 24,
  /** Pack attempts per category per chunk per cycle. */
  packAttemptsPerChunk: 3,
  maxPackSize: 4,

  /** Mob caps for a full 17x17 chunk area; scaled by loaded chunks / 289. */
  monsterCap: 70,
  creatureCap: 10,
  capReferenceChunks: 289,

  /** Passive spots that are not sunlit need this much block light. */
  passiveMinBlockLight: 9,
  /** Hostile spots need block light 0 and internal sky light at most this. */
  hostileMaxSkyLight: 7,
  /** Sky darkening at full night (full day = 0). */
  nightSkyDarkening: 11,

  /** Non-persistent mobs farther than this vanish at once. */
  despawnInstantDistance: 128,
  /** Beyond this they may despawn at random... */
  despawnRandomDistance: 32,
  /** ...once they have been that far for this long... */
  despawnFarSeconds: 30,
  /** ...with this chance per tick. */
  despawnChancePerTick: 1 / 800,

  /** Hostile humanoids take damage in direct sunlight. */
  burnInSunlight: true,
  /** Sunburn damage (half-hearts) every `sunBurnInterval` seconds. */
  sunBurnDamage: 1,
  sunBurnInterval: 1,
  /** Hostile mobs notice a player within this range. */
  aggroRange: 16,
  /** Melee reach and pause between hits. */
  attackReach: 1.6,
  attackCooldownSeconds: 1,
  /** Rattlers: preferred range band, seconds between shots, arrow speed and damage. */
  archerMinRange: 5,
  archerMaxRange: 12,
  archerShotSeconds: [1.4, 2.6] as [number, number],
  archerArrowSpeed: 24,
  archerArrowDamage: [2, 4] as [number, number],
  archerSpread: 0.035,
  /** Creepcrawlers lunge at the player from this distance. */
  spiderLeapRange: 3.5,
  /** Lambs grow up after this many seconds. */
  growUpSeconds: 1200,
} as const;

export type SpawnConfig = typeof SPAWN_CONFIG;

import { CHUNK_HEIGHT, CHUNK_SIZE } from "../config";
import { B, IS_OPAQUE, IS_SOLID } from "../world/blocks";
import type { World } from "../world/world";
import type { EntityManager } from "./entityManager";
import { typesIn, type SpawnCategory } from "./mobTypes";
import { SPAWN_CONFIG } from "./spawnConfig";
import {
  canSpawnHostile, canSpawnPassive, isFree, isHostileSpot, packSize, pickWeighted, scaledCap, shouldDespawn, triangular,
} from "./spawnRules";

export interface SpawnerEnv {
  player: { x: number; y: number; z: number };
  timeTicks: number;
  passiveEnabled: boolean;
  hostileEnabled: boolean;
}

export interface SpawnStats {
  monsters: number;
  monsterCap: number;
  creatures: number;
  creatureCap: number;
  persistent: number;
  attemptsPerSecond: number;
  /** Average and worst cost of the spawn/despawn work per frame, in ms. */
  avgMs: number;
  maxMs: number;
}

/**
 * The ongoing spawn cycle and despawning, run on game ticks (20 per second)
 * so pausing the game pauses it too. The rules live in spawnRules.ts.
 */
export class Spawner {
  readonly stats: SpawnStats = { monsters: 0, monsterCap: 0, creatures: 0, creatureCap: 0, persistent: 0, attemptsPerSecond: 0, avgMs: 0, maxMs: 0 };
  private tickAccum = 0;
  private passiveTicks = 0;
  private hostileQueue: [number, number][] = [];
  private attempts = 0;
  private attemptsWindow = 0;
  private maxWindow = 0;

  constructor(private world: World, private entities: EntityManager, private rng: () => number = Math.random) {}

  update(dt: number, env: SpawnerEnv) {
    const t0 = performance.now();
    this.tickAccum += dt * 20;
    let ticks = Math.floor(this.tickAccum);
    this.tickAccum -= ticks;
    ticks = Math.min(ticks, 4);
    for (let i = 0; i < ticks; i++) this.tick(env);

    this.attemptsWindow += dt;
    if (this.attemptsWindow >= 1) {
      this.stats.attemptsPerSecond = Math.round(this.attempts / this.attemptsWindow);
      this.attempts = 0;
      this.attemptsWindow = 0;
      this.stats.maxMs = this.maxWindow;
      this.maxWindow = 0;
    }
    const ms = performance.now() - t0;
    this.stats.avgMs = this.stats.avgMs * 0.95 + ms * 0.05;
    this.maxWindow = Math.max(this.maxWindow, ms);
  }

  /** Chunks whose centre is within the spawn radius of the player (and that have light computed). */
  private eligibleChunks(px: number, pz: number): [number, number][] {
    const r = SPAWN_CONFIG.spawnChunkRadius;
    const list: [number, number][] = [];
    for (const chunk of this.world.chunks.values()) {
      if (!chunk.light) continue;
      const dx = chunk.cx * CHUNK_SIZE + 8 - px;
      const dz = chunk.cz * CHUNK_SIZE + 8 - pz;
      if (dx * dx + dz * dz <= r * r) list.push([chunk.cx, chunk.cz]);
    }
    return list;
  }

  private countMobs() {
    let monsters = 0;
    let creatures = 0;
    let persistent = 0;
    for (const m of this.entities.mobs.values()) {
      if (m.persistent) persistent++;
      else if (m.hostile) monsters++;
      else creatures++;
    }
    return { monsters, creatures, persistent };
  }

  private tick(env: SpawnerEnv) {
    const p = env.player;
    this.despawnTick(p, env.hostileEnabled);

    const chunks = this.eligibleChunks(p.x, p.z);
    const counts = this.countMobs();
    const s = this.stats;
    s.monsterCap = scaledCap(SPAWN_CONFIG.monsterCap, chunks.length);
    s.creatureCap = scaledCap(SPAWN_CONFIG.creatureCap, chunks.length);
    s.monsters = counts.monsters;
    s.creatures = counts.creatures;
    s.persistent = counts.persistent;

    // Hostile: every tick, but only a slice of the chunks so the cost stays flat.
    if (env.hostileEnabled && s.monsters < s.monsterCap) {
      if (!this.hostileQueue.length) this.hostileQueue = this.shuffled(chunks);
      for (let i = 0; i < SPAWN_CONFIG.hostileChunksPerTick && this.hostileQueue.length; i++) {
        const [cx, cz] = this.hostileQueue.pop()!;
        if (!this.world.chunkAt(cx, cz)?.light) continue;
        s.monsters += this.spawnInChunk("monster", cx, cz, env, s.monsterCap - s.monsters);
        if (s.monsters >= s.monsterCap) break;
      }
    }

    // Passive: one full pass every 400 ticks.
    this.passiveTicks++;
    if (this.passiveTicks >= SPAWN_CONFIG.passiveIntervalTicks) {
      this.passiveTicks = 0;
      if (env.passiveEnabled) {
        for (const [cx, cz] of this.shuffled(chunks)) {
          if (s.creatures >= s.creatureCap) break;
          s.creatures += this.spawnInChunk("creature", cx, cz, env, s.creatureCap - s.creatures);
        }
      }
    }
  }

  private shuffled<T>(list: T[]) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Up to three pack attempts from one random point in the chunk. Returns mobs spawned. */
  private spawnInChunk(category: SpawnCategory, cx: number, cz: number, env: SpawnerEnv, room: number): number {
    const w = this.world;
    const rng = this.rng;
    const x = cx * CHUNK_SIZE + Math.floor(rng() * CHUNK_SIZE);
    const z = cz * CHUNK_SIZE + Math.floor(rng() * CHUNK_SIZE);
    let top = CHUNK_HEIGHT - 1;
    while (top > 0 && w.getBlock(x, top, z) === B.AIR) top--;
    // Anywhere from the floor to one above the surface: this is why caves are dangerous.
    const y = Math.floor(rng() * (top + 2));
    const start = w.getBlock(x, y, z);
    if (IS_OPAQUE[start] && IS_SOLID[start]) return 0;

    const types = typesIn(category);
    const p = env.player;
    const blockAt = (bx: number, by: number, bz: number) => w.getBlock(bx, by, bz);
    let spawned = 0;
    for (let pack = 0; pack < SPAWN_CONFIG.packAttemptsPerChunk; pack++) {
      const def = pickWeighted(rng, types);
      const size = packSize(rng, def);
      for (let m = 0; m < size; m++) {
        this.attempts++;
        const mx = x + triangular(rng, SPAWN_CONFIG.packSpread);
        const mz = z + triangular(rng, SPAWN_CONFIG.packSpread);
        const fx = mx + 0.5;
        const fz = mz + 0.5;
        const dist = Math.hypot(fx - p.x, y - p.y, fz - p.z);
        if (dist < SPAWN_CONFIG.minPlayerDistance || dist > SPAWN_CONFIG.spawnSphereRadius) continue;
        if (!w.chunkAt(Math.floor(mx / 16), Math.floor(mz / 16))?.light) continue;
        const light = w.getLight(mx, y, mz);
        if (category === "monster") {
          if (!isHostileSpot(blockAt, mx, y, mz) || !canSpawnHostile(light & 15, light >> 4, env.timeTicks)) continue;
        } else {
          if (w.getBlock(mx, y - 1, mz) !== B.GRASS || !isFree(w.getBlock(mx, y, mz)) || !isFree(w.getBlock(mx, y + 1, mz))) continue;
          if (!canSpawnPassive(light & 15, light >> 4)) continue;
        }
        this.entities.spawn(def.type, fx, y, fz);
        spawned++;
      }
      // The cap is checked per pack, so a pack may overshoot it by up to its size.
      if (spawned >= room) break;
    }
    return spawned;
  }

  /** Despawning for non-persistent mobs; Peaceful also clears hostiles. */
  private despawnTick(p: { x: number; y: number; z: number }, hostileEnabled: boolean) {
    for (const mob of [...this.entities.mobs.values()]) {
      if (mob.hostile && !hostileEnabled) {
        this.entities.remove(mob);
        continue;
      }
      if (mob.persistent) continue;
      const distance = Math.hypot(mob.pos.x - p.x, mob.pos.y - p.y, mob.pos.z - p.z);
      if (distance > SPAWN_CONFIG.despawnRandomDistance) mob.farSeconds += 1 / 20;
      else mob.farSeconds = 0;
      if (shouldDespawn({ persistent: mob.persistent, distance, farSeconds: mob.farSeconds, roll: this.rng() })) this.entities.remove(mob);
    }
  }
}

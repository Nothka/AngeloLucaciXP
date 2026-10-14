import * as THREE from "three";
import { chunkKey } from "../config";
import { rayAABB } from "../player/raycast";
import { IS_OPAQUE, isWater } from "../world/blocks";
import type { World } from "../world/world";
import type { EntityRecord } from "../save/db";
import { Mob, type MobSpawnOptions } from "./mob";
import { updateAI, type AIContext } from "./mobAI";
import { MobRenderer } from "./mobModels";
import type { MobType } from "./mobTypes";
import { solidTester, type SolidAt } from "./physics";
import { SPAWN_CONFIG } from "./spawnConfig";

export interface EntityHooks {
  spawnDrop(item: number, count: number, x: number, y: number, z: number): void;
  onMobKilled(mob: Mob): void;
  spawnXp(points: number, x: number, y: number, z: number): void;
  shootArrow(mob: Mob, target: { x: number; y: number; z: number }): void;
}

export interface EntityFrame {
  time: number;
  daylight: number;
  isDay: boolean;
  /** Player position when hostile mobs may target them, else null. */
  target: { x: number; y: number; z: number } | null;
  hurtTarget(mob: Mob, amount: number): void;
}

const DEATH_SECONDS = 0.6;

/** Owns every live mob: AI, physics, death and drops, chunk bookkeeping and rendering. */
export class EntityManager {
  readonly mobs = new Map<number, Mob>();
  readonly renderer = new MobRenderer();
  readonly solidAt: SolidAt;
  /** Mob id -> key of the chunk it currently stands in. */
  private owner = new Map<number, string>();

  constructor(private world: World, private hooks: EntityHooks) {
    this.solidAt = solidTester(world);
  }

  get group() {
    return this.renderer.group;
  }

  spawn(type: MobType, x: number, y: number, z: number, opts: MobSpawnOptions = {}): Mob {
    const mob = new Mob(type, x, y, z, opts);
    this.mobs.set(mob.id, mob);
    this.owner.set(mob.id, this.chunkOf(mob));
    return mob;
  }

  remove(mob: Mob) {
    this.mobs.delete(mob.id);
    this.owner.delete(mob.id);
  }

  chunkOf(mob: Mob) {
    return chunkKey(Math.floor(Math.floor(mob.pos.x) / 16), Math.floor(Math.floor(mob.pos.z) / 16));
  }

  /** Mobs owned by a chunk (by where they stand right now). */
  inChunk(key: string): Mob[] {
    const list: Mob[] = [];
    for (const [id, k] of this.owner) if (k === key) list.push(this.mobs.get(id)!);
    return list;
  }

  update(dt: number, frame: EntityFrame) {
    const ctx: AIContext = {
      solidAt: this.solidAt,
      getBlock: (x, y, z) => this.world.getBlock(x, y, z),
      target: frame.target,
      hurtTarget: frame.hurtTarget,
      lightAt: (x, y, z) => this.world.getLight(x, y, z),
      lineOfSight: (ax, ay, az, bx, by, bz) => this.lineOfSight(ax, ay, az, bx, by, bz),
      shootArrow: (mob, target) => this.hooks.shootArrow(mob, target),
      isDay: frame.isDay,
    };
    for (const mob of [...this.mobs.values()]) {
      const bx = Math.floor(mob.pos.x);
      const bz = Math.floor(mob.pos.z);
      // Mobs in a column that is not loaded wait (their chunk is about to unload or load).
      if (!this.world.isLoaded(bx, bz)) continue;
      mob.inWater = isWater(this.world.getBlock(bx, Math.floor(mob.pos.y + mob.height * 0.4), bz));
      updateAI(mob, dt, ctx);
      mob.physics(dt, this.solidAt);
      mob.age += dt;
      if (mob.baby && mob.age > SPAWN_CONFIG.growUpSeconds) mob.growUp();
      if (mob.pos.y < -20) {
        this.remove(mob);
        continue;
      }
      if (mob.dead) {
        mob.deathTime += dt;
        if (mob.deathTime >= DEATH_SECONDS) this.kill(mob);
        continue;
      }
      this.owner.set(mob.id, this.chunkOf(mob));
    }
    this.renderer.update(this.mobs.values(), frame.daylight, frame.time, (mob) =>
      this.world.getLight(Math.floor(mob.pos.x), Math.floor(mob.pos.y + Math.min(1, mob.height * 0.6)), Math.floor(mob.pos.z)),
    );
  }

  private kill(mob: Mob) {
    this.remove(mob);
    if (!mob.baby) {
      for (const d of mob.def.drops) {
        if (d.chance !== undefined && Math.random() >= d.chance) continue;
        const item = d.oneOf ? d.oneOf[Math.floor(Math.random() * d.oneOf.length)] : d.item;
        const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
        if (n > 0) this.hooks.spawnDrop(item, n, mob.pos.x, mob.pos.y + 0.5, mob.pos.z);
      }
      if (mob.killedByPlayer) {
        const [lo, hi] = mob.def.xp;
        this.hooks.spawnXp(lo + Math.floor(Math.random() * (hi - lo + 1)), mob.pos.x, mob.pos.y + 0.5, mob.pos.z);
      }
    }
    this.hooks.onMobKilled(mob);
  }

  /** Samples the segment every quarter block; any opaque block blocks the view. */
  lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const steps = Math.ceil(len / 0.25);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const id = this.world.getBlock(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t), Math.floor(az + (bz - az) * t));
      if (IS_OPAQUE[id]) return false;
    }
    return true;
  }

  /** True if any living mob's box overlaps the block cell. */
  occupies(x: number, y: number, z: number) {
    for (const m of this.mobs.values()) {
      if (m.dead) continue;
      if (x + 1 > m.pos.x - m.half && x < m.pos.x + m.half && y + 1 > m.pos.y && y < m.pos.y + m.height && z + 1 > m.pos.z - m.half && z < m.pos.z + m.half) return true;
    }
    return false;
  }

  /** Nearest living mob whose box the ray enters within `maxDist`. */
  pick(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): { mob: Mob; dist: number } | null {
    let best: { mob: Mob; dist: number } | null = null;
    for (const mob of this.mobs.values()) {
      if (mob.dead) continue;
      if (mob.pos.distanceToSquared(origin) > (maxDist + 3) ** 2) continue;
      const t = rayAABB(origin, dir, mob.pos.x - mob.half, mob.pos.y, mob.pos.z - mob.half, mob.pos.x + mob.half, mob.pos.y + mob.height, mob.pos.z + mob.half);
      if (t !== null && t <= maxDist && (!best || t < best.dist)) best = { mob, dist: t };
    }
    return best;
  }

  /** Saveable form of the persistent mobs standing in a chunk. */
  records(key: string): EntityRecord[] {
    return this.inChunk(key)
      .filter((m) => m.persistent && !m.dead)
      .map((m) => ({
        type: m.type, x: m.pos.x, y: m.pos.y, z: m.pos.z, yaw: m.yaw,
        health: m.health, color: m.color, baby: m.baby, age: m.age,
      }));
  }

  /** Drops every mob in a chunk from memory (hostile and wandering ones simply vanish). */
  unloadChunk(key: string) {
    for (const mob of this.inChunk(key)) this.remove(mob);
  }

  clear() {
    this.mobs.clear();
    this.owner.clear();
  }
}

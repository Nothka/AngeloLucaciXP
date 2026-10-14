import * as THREE from "three";
import { chunkKey } from "../config";
import { rayAABB } from "../player/raycast";
import { B, I, IS_OPAQUE, isWater } from "../world/blocks";
import type { World } from "../world/world";
import type { EntityRecord } from "../save/db";
import { Mob, type MobSpawnOptions } from "./mob";
import { updateAI, type AIContext } from "./mobAI";
import { MobRenderer } from "./mobModels";
import { woolFor, type MobType } from "./mobTypes";
import { solidTester, type SolidAt } from "./physics";
import { SPAWN_CONFIG } from "./spawnConfig";
import {
  BREED_COOLDOWN_SECONDS, BREED_DISTANCE, BREED_SECONDS, PARTNER_RANGE, TEMPT_RANGE, TICK, ambientTick, grazeChance, nextEggDelay, stepLength,
} from "./animalLife";
import { HeartParticles } from "./hearts";
import type { MobSound } from "../audio/audio";

export interface EntityHooks {
  spawnDrop(item: number, count: number, x: number, y: number, z: number): void;
  onMobKilled(mob: Mob): void;
  spawnXp(points: number, x: number, y: number, z: number): void;
  shootArrow(mob: Mob, target: { x: number; y: number; z: number }): void;
  /** A mob makes a sound (idle chatter, pain, laying an egg...). */
  sound(mob: Mob, sound: MobSound): void;
  /** Two animals had a baby. */
  bred?(baby: Mob): void;
}

export interface EntityFrame {
  time: number;
  daylight: number;
  isDay: boolean;
  /** Player position when hostile mobs may target them, else null. */
  target: { x: number; y: number; z: number } | null;
  hurtTarget(mob: Mob, amount: number): void;
  /** The player and what they hold, so animals can follow their food. */
  holder?: { x: number; y: number; z: number; item: number } | null;
}

const DEATH_SECONDS = 0.6;

/** Owns every live mob: AI, physics, death and drops, chunk bookkeeping and rendering. */
export class EntityManager {
  readonly mobs = new Map<number, Mob>();
  readonly renderer = new MobRenderer();
  readonly hearts = new HeartParticles();
  readonly solidAt: SolidAt;
  /** Mob id -> key of the chunk it currently stands in. */
  private owner = new Map<number, string>();

  constructor(private world: World, private hooks: EntityHooks) {
    this.solidAt = solidTester(world);
  }

  private root: THREE.Group | null = null;
  get group() {
    if (!this.root) {
      this.root = new THREE.Group();
      this.root.add(this.renderer.group, this.hearts.group);
    }
    return this.root;
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
    this.updateAnimalLife(dt, frame);
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
      if (mob.pendingSound) {
        this.hooks.sound(mob, mob.pendingSound);
        mob.pendingSound = null;
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

  /**
   * Idle sounds (every mob rolls its own dice each tick, so a crowded farm
   * is a constant din), love and breeding, following food, and eggs.
   */
  private updateAnimalLife(dt: number, frame: EntityFrame) {
    const holder = frame.holder ?? null;
    const lovers: Mob[] = [];
    for (const mob of this.mobs.values()) {
      if (mob.dead) continue;
      mob.soundClock += dt;
      while (mob.soundClock >= TICK) {
        mob.soundClock -= TICK;
        const r = ambientTick(mob.ambientCounter, Math.random);
        mob.ambientCounter = r.counter;
        if (r.play) this.hooks.sound(mob, "idle");
        if (mob.type === "sheep" && Math.random() < grazeChance(mob.baby)) this.graze(mob);
      }
      if (mob.stepDist >= stepLength(mob.def.width * mob.scale)) {
        mob.stepDist = 0;
        this.hooks.sound(mob, "step");
      }
      if (mob.grazing > 0) mob.grazing -= dt;
      if (mob.hostile) continue;
      mob.breedCooldown = Math.max(0, mob.breedCooldown - dt);
      if (mob.love > 0) {
        mob.love = Math.max(0, mob.love - dt);
        mob.heartTimer -= dt;
        if (mob.heartTimer <= 0) {
          mob.heartTimer = 0.7;
          this.hearts.emit(mob.pos.x, mob.pos.y + mob.height + 0.2, mob.pos.z);
        }
        if (mob.love > 0) lovers.push(mob);
        else mob.partner = null;
      }
      // Animals follow a player holding the food they breed with.
      const food = mob.def.breedFood;
      mob.tempter = null;
      if (holder && food?.includes(holder.item) && mob.panicTime <= 0) {
        const d = Math.hypot(holder.x - mob.pos.x, holder.z - mob.pos.z);
        if (d < TEMPT_RANGE && Math.abs(holder.y - mob.pos.y) < 4) mob.tempter = { x: holder.x, z: holder.z };
      }
      if (mob.type === "chicken" && !mob.baby) {
        mob.eggTimer -= dt;
        if (mob.eggTimer <= 0) {
          mob.eggTimer = nextEggDelay(Math.random);
          this.hooks.spawnDrop(I.EGG, 1, mob.pos.x, mob.pos.y + 0.3, mob.pos.z);
          this.hooks.sound(mob, "plop");
        }
      }
    }
    // Pair up animals in love, then let them meet.
    for (const mob of lovers) {
      const p = mob.partner;
      if (p && (p.dead || p.love <= 0 || !this.mobs.has(p.id))) mob.partner = null;
      if (mob.partner) continue;
      let best: Mob | null = null;
      let bestD = PARTNER_RANGE;
      for (const other of lovers) {
        if (other === mob || other.type !== mob.type || (other.partner && other.partner !== mob)) continue;
        const d = other.pos.distanceTo(mob.pos);
        if (d < bestD) {
          best = other;
          bestD = d;
        }
      }
      if (best) {
        mob.partner = best;
        best.partner = mob;
      }
    }
    for (const mob of lovers) {
      const p = mob.partner;
      if (!p || p.id < mob.id) continue; // handle each pair once
      if (mob.pos.distanceTo(p.pos) > BREED_DISTANCE) {
        mob.together = p.together = 0;
        continue;
      }
      mob.together += dt;
      if (mob.together < BREED_SECONDS) continue;
      for (const parent of [mob, p]) {
        parent.love = 0;
        parent.partner = null;
        parent.together = 0;
        parent.breedCooldown = BREED_COOLDOWN_SECONDS;
      }
      const x = (mob.pos.x + p.pos.x) / 2, z = (mob.pos.z + p.pos.z) / 2;
      // Lambs take after one of their parents.
      const color = mob.type === "sheep" ? (Math.random() < 0.5 ? mob.color : p.color) : 0;
      const baby = this.spawn(mob.type, x, Math.max(mob.pos.y, p.pos.y), z, { baby: true, persistent: true, color });
      this.hooks.bred?.(baby);
      this.hooks.spawnXp(1 + Math.floor(Math.random() * 7), x, mob.pos.y + 0.5, z);
      for (let i = 0; i < 5; i++) this.hearts.emit(x, mob.pos.y + mob.height, z);
    }
    this.hearts.update(dt);
  }

  /** A sheep eats the tall grass it stands in, or the grass block under it (which turns to dirt). */
  private graze(mob: Mob) {
    if (!mob.onGround || mob.panicTime > 0 || mob.partner || mob.tempter || mob.grazing > 0) return;
    const x = Math.floor(mob.pos.x), y = Math.floor(mob.pos.y + 0.01), z = Math.floor(mob.pos.z);
    const w = this.world;
    if (w.getBlock(x, y, z) === B.TALL_GRASS) w.setBlock(x, y, z, B.AIR);
    else if (w.getBlock(x, y - 1, z) === B.GRASS) w.setBlock(x, y - 1, z, B.DIRT);
    else return;
    mob.grazing = 2;
    mob.wanderTimer = Math.max(mob.wanderTimer, 2);
    // Eating makes lambs grow up a minute sooner.
    if (mob.baby) mob.age += 60;
    this.hooks.sound(mob, "graze");
  }

  private kill(mob: Mob) {
    this.remove(mob);
    if (!mob.baby) {
      for (const d of mob.def.drops) {
        if (d.chance !== undefined && Math.random() >= d.chance) continue;
        let item = d.oneOf ? d.oneOf[Math.floor(Math.random() * d.oneOf.length)] : d.item;
        if (mob.type === "sheep" && item === B.WOOL_WHITE) item = woolFor(mob.color);
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
    this.hearts.clear();
  }
}

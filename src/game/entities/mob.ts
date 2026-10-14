import * as THREE from "three";
import type { Attackable } from "../items/combat";
import { MOB_TYPES, type MobDef, type MobType } from "./mobTypes";
import { sweepAxis, type Body, type SolidAt } from "./physics";

const GRAVITY = 32;
const TERMINAL = 60;
let nextId = 1;

export interface MobSpawnOptions {
  persistent?: boolean;
  /** Index into SHEEP_COLORS. */
  color?: number;
  baby?: boolean;
  health?: number;
  yaw?: number;
  age?: number;
}

/** One living mob: position, physics state, health and the bits of AI state it carries. */
export class Mob implements Body, Attackable {
  readonly id = nextId++;
  readonly def: MobDef;
  readonly pos: THREE.Vector3;
  /** Where it spawned (debugging and determinism checks). */
  readonly origin: [number, number, number];
  readonly vel = new THREE.Vector3();
  yaw: number;
  half: number;
  height: number;
  onGround = false;
  horizontalCollision = false;
  inWater = false;
  health: number;
  /** Persistent mobs (generated with the chunk) never despawn and are saved. */
  persistent: boolean;
  color: number;
  baby: boolean;
  /** Seconds alive, for lambs growing up. */
  age: number;
  /** Seconds spent beyond the random-despawn distance. */
  farSeconds = 0;
  /** Seconds since the last hit (drives the red flash). */
  hurtTime = 10;
  /** >= 0 while the death animation plays. */
  deathTime = -1;
  burning = false;
  /** Weapon of the last hit, so kills can be credited. */
  lastWeapon = -1;
  killedByPlayer = false;

  // Movement wish set by the AI each frame.
  wishX = 0;
  wishZ = 0;
  wishSpeed = 0;
  wantJump = false;
  /** Smoothed horizontal speed and walk cycle for the leg animation. */
  moveAmount = 0;
  walkPhase = 0;
  /** 0..1 arm swing after a melee hit. */
  attackAnim = 1;

  /** Bow raised toward the target (ranged mobs). */
  aiming = false;
  aimTime = 0;
  shotDelay = 2;
  strafeDir = 1;
  strafeTimer = 0;
  /** Seconds left of being provoked (neutral mobs). */
  angry = 0;

  // AI bookkeeping.
  wanderTimer = 0;
  panicTime = 0;
  attackCooldown = 0;
  knockTime = 0;
  burnTimer = 0;
  private invulnerable = 0;

  constructor(readonly type: MobType, x: number, y: number, z: number, opts: MobSpawnOptions = {}) {
    this.def = MOB_TYPES[type];
    this.pos = new THREE.Vector3(x, y, z);
    this.origin = [x, y, z];
    this.baby = !!opts.baby;
    this.half = (this.def.width * this.scale) / 2;
    this.height = this.def.height * this.scale;
    this.health = opts.health ?? this.def.maxHealth;
    this.persistent = !!opts.persistent;
    this.color = opts.color ?? 0;
    this.yaw = opts.yaw ?? Math.random() * Math.PI * 2;
    this.age = opts.age ?? 0;
  }

  get name() {
    return this.def.name;
  }

  get hostile() {
    return this.def.category === "monster";
  }

  get scale() {
    return this.baby ? 0.55 : 1;
  }

  get dead() {
    return this.deathTime >= 0;
  }

  growUp() {
    this.baby = false;
    this.half = this.def.width / 2;
    this.height = this.def.height;
  }

  /** Attackable: take damage, flash red and get knocked away from the attacker. */
  hurt(amount: number, source: { weapon: number; from?: { x: number; z: number } }) {
    if (this.dead || this.invulnerable > 0) return;
    this.health -= amount;
    this.hurtTime = 0;
    this.invulnerable = 0.5;
    if (source.weapon >= 0) {
      this.lastWeapon = source.weapon;
      this.killedByPlayer = true;
    }
    if (source.from) {
      const dx = this.pos.x - source.from.x;
      const dz = this.pos.z - source.from.z;
      const len = Math.hypot(dx, dz) || 1;
      this.vel.x = (dx / len) * 7;
      this.vel.z = (dz / len) * 7;
      this.vel.y = 5;
      this.knockTime = 0.35;
    }
    if (!this.hostile) this.panicTime = 4;
    else if (source.weapon >= 0) this.angry = 30;
    if (this.health <= 0) this.deathTime = 0;
  }

  /** Gravity, buoyancy, steering toward the AI's wish and the shared AABB sweep. */
  physics(dt: number, solidAt: SolidAt) {
    this.hurtTime += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.attackAnim = Math.min(1, this.attackAnim + dt / 0.4);
    if (this.knockTime > 0) this.knockTime -= dt;

    if (this.knockTime <= 0) {
      const accel = this.onGround ? 12 : this.inWater ? 4 : 2;
      const k = 1 - Math.exp(-accel * dt);
      this.vel.x += (this.wishX * this.wishSpeed - this.vel.x) * k;
      this.vel.z += (this.wishZ * this.wishSpeed - this.vel.z) * k;
    } else if (this.onGround) {
      this.vel.x *= Math.exp(-4 * dt);
      this.vel.z *= Math.exp(-4 * dt);
    }

    if (this.inWater) {
      this.vel.y = Math.min(this.vel.y + 22 * dt, 2.2);
    } else if (this.def.climbs && this.horizontalCollision && this.wishSpeed > 0) {
      // Wall climbing: walk straight up whatever is in the way.
      this.vel.y = Math.max(this.vel.y, 3.2);
    } else {
      if (this.wantJump && this.onGround) this.vel.y = 8.9;
      this.vel.y = Math.max(this.vel.y - GRAVITY * dt, -TERMINAL);
    }

    this.onGround = false;
    this.horizontalCollision = false;
    const bx = this.pos.x;
    const bz = this.pos.z;
    sweepAxis(this, 1, this.vel.y * dt, solidAt);
    sweepAxis(this, 0, this.vel.x * dt, solidAt);
    sweepAxis(this, 2, this.vel.z * dt, solidAt);

    const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
    this.moveAmount += (Math.min(1, moved / dt / 2.5) - this.moveAmount) * Math.min(1, dt * 10);
    this.walkPhase += moved * 2.2;
  }
}

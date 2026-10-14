import { isWater } from "../world/blocks";
import type { Mob } from "./mob";
import type { SolidAt } from "./physics";
import { SPAWN_CONFIG } from "./spawnConfig";

export interface AIContext {
  /** Clear view between two points (no opaque blocks in the way). */
  lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean;
  shootArrow(mob: Mob, target: { x: number; y: number; z: number }): void;
  solidAt: SolidAt;
  getBlock(x: number, y: number, z: number): number;
  /** The player, when hostile mobs may target them (Survival, alive). */
  target: { x: number; y: number; z: number } | null;
  hurtTarget(mob: Mob, amount: number): void;
  /** Packed light (sky << 4 | block) at a position. */
  lightAt(x: number, y: number, z: number): number;
  isDay: boolean;
}

const turnToward = (mob: Mob, x: number, z: number, dt: number) => {
  const target = Math.atan2(x, z);
  let d = target - mob.yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  mob.yaw += d * Math.min(1, dt * 8);
};

/** True if stepping forward would drop more than two blocks (or into water, for animals). */
function unsafeAhead(mob: Mob, dx: number, dz: number, ctx: AIContext): boolean {
  const ax = Math.floor(mob.pos.x + dx * (mob.half + 0.4));
  const az = Math.floor(mob.pos.z + dz * (mob.half + 0.4));
  const fy = Math.floor(mob.pos.y + 0.01);
  if (isWater(ctx.getBlock(ax, fy, az)) || isWater(ctx.getBlock(ax, fy - 1, az))) return true;
  if (ctx.solidAt(ax, fy, az)) return false; // a wall, handled by jumping
  for (let d = 1; d <= 3; d++) if (ctx.solidAt(ax, fy - d, az)) return false;
  return true;
}

/** Jump when blocked by a single block with room above it. */
function wantsJump(mob: Mob, dx: number, dz: number, ctx: AIContext) {
  if (!mob.horizontalCollision || !mob.onGround) return false;
  const ax = Math.floor(mob.pos.x + dx * (mob.half + 0.4));
  const az = Math.floor(mob.pos.z + dz * (mob.half + 0.4));
  const fy = Math.floor(mob.pos.y + 0.01);
  return !ctx.solidAt(ax, fy + 1, az) && !ctx.solidAt(ax, fy + 2, az);
}

function wander(mob: Mob, dt: number, ctx: AIContext, speedScale: number) {
  mob.wanderTimer -= dt;
  if (mob.wanderTimer <= 0) {
    mob.wanderTimer = 3 + Math.random() * 5;
    if (Math.random() < 0.35) {
      mob.wishSpeed = 0;
    } else {
      const a = Math.random() * Math.PI * 2;
      mob.wishX = Math.sin(a);
      mob.wishZ = Math.cos(a);
      mob.wishSpeed = mob.def.speed * speedScale;
    }
  }
  if (mob.wishSpeed > 0 && !mob.inWater && unsafeAhead(mob, mob.wishX, mob.wishZ, ctx)) {
    // Never walk off a tall drop: stop and pick a new heading soon.
    mob.wishSpeed = 0;
    mob.wanderTimer = Math.min(mob.wanderTimer, 0.6);
  }
}

/** Passive: wander, panic when hurt. Hostile: chase and hit the player in range. */
export function updateAI(mob: Mob, dt: number, ctx: AIContext) {
  mob.wantJump = false;
  if (mob.dead) {
    mob.wishSpeed = 0;
    return;
  }
  mob.attackCooldown = Math.max(0, mob.attackCooldown - dt);

  mob.aiming = false;
  if (mob.angry > 0) mob.angry -= dt;
  const provoked = !mob.def.neutralInDay || !ctx.isDay || mob.angry > 0;
  if (mob.hostile && ctx.target && provoked) {
    const t = ctx.target;
    const dx = t.x - mob.pos.x;
    const dz = t.z - mob.pos.z;
    const dist = Math.hypot(dx, dz);
    const dy = t.y - mob.pos.y;
    if (mob.def.ranged && Math.hypot(dist, dy) <= SPAWN_CONFIG.aggroRange) {
      archer(mob, dt, ctx, t, dx, dz, dist);
      burn(mob, dt, ctx);
      return;
    }
    if (Math.hypot(dist, dy) <= SPAWN_CONFIG.aggroRange) {
      if (mob.def.climbs && mob.onGround && dist > 1.6 && dist < SPAWN_CONFIG.spiderLeapRange && Math.random() < dt * 1.5) {
        // Pounce.
        mob.vel.x = (dx / dist) * 6;
        mob.vel.z = (dz / dist) * 6;
        mob.vel.y = 5.5;
        mob.knockTime = 0.25;
      }
      mob.wishX = dist > 0.01 ? dx / dist : 0;
      mob.wishZ = dist > 0.01 ? dz / dist : 0;
      mob.wishSpeed = dist > 0.8 ? mob.def.speed : 0;
      turnToward(mob, dx, dz, dt);
      mob.wantJump = wantsJump(mob, mob.wishX, mob.wishZ, ctx);
      if (dist < SPAWN_CONFIG.attackReach && Math.abs(dy) < 1.6 && mob.attackCooldown <= 0) {
        mob.attackCooldown = SPAWN_CONFIG.attackCooldownSeconds;
        mob.attackAnim = 0;
        ctx.hurtTarget(mob, mob.def.attack ?? 1);
      }
      burn(mob, dt, ctx);
      return;
    }
  }

  if (mob.panicTime > 0) {
    mob.panicTime -= dt;
    if (mob.wanderTimer > 1 || mob.wishSpeed === 0) {
      const a = Math.random() * Math.PI * 2;
      mob.wishX = Math.sin(a);
      mob.wishZ = Math.cos(a);
      mob.wanderTimer = 1;
    }
    mob.wanderTimer -= dt;
    mob.wishSpeed = mob.def.speed * 2.2;
  } else {
    wander(mob, dt, ctx, mob.hostile ? 0.5 : 1);
  }
  if (mob.wishSpeed > 0) {
    turnToward(mob, mob.wishX, mob.wishZ, dt);
    mob.wantJump = wantsJump(mob, mob.wishX, mob.wishZ, ctx);
  }
  if (mob.inWater) mob.wantJump = true;
  burn(mob, dt, ctx);
}

/**
 * Ranged attacker: close in until within range, back off when crowded,
 * strafe in between, and loose an arrow whenever it has a clear shot.
 */
function archer(mob: Mob, dt: number, ctx: AIContext, t: { x: number; y: number; z: number }, dx: number, dz: number, dist: number) {
  const eyeY = mob.pos.y + mob.height * 0.85;
  const sees = ctx.lineOfSight(mob.pos.x, eyeY, mob.pos.z, t.x, t.y + 1.4, t.z);
  const nx = dist > 0.01 ? dx / dist : 0;
  const nz = dist > 0.01 ? dz / dist : 0;
  mob.strafeTimer -= dt;
  if (mob.strafeTimer <= 0) {
    mob.strafeTimer = 1.5 + Math.random() * 2;
    mob.strafeDir = Math.random() < 0.5 ? -1 : 1;
  }
  if (!sees || dist > SPAWN_CONFIG.archerMaxRange) {
    mob.wishX = nx; mob.wishZ = nz; mob.wishSpeed = mob.def.speed;
  } else if (dist < SPAWN_CONFIG.archerMinRange) {
    mob.wishX = -nx; mob.wishZ = -nz; mob.wishSpeed = mob.def.speed * 0.8;
    if (unsafeAhead(mob, -nx, -nz, ctx)) mob.wishSpeed = 0;
  } else {
    // Sidestep around the target.
    mob.wishX = -nz * mob.strafeDir; mob.wishZ = nx * mob.strafeDir; mob.wishSpeed = mob.def.speed * 0.4;
    if (unsafeAhead(mob, mob.wishX, mob.wishZ, ctx)) mob.strafeDir *= -1;
  }
  mob.wantJump = wantsJump(mob, mob.wishX, mob.wishZ, ctx);
  turnToward(mob, dx, dz, dt * 2);
  if (!sees) {
    mob.aimTime = 0;
    return;
  }
  mob.aiming = true;
  mob.aimTime += dt;
  if (mob.aimTime >= mob.shotDelay) {
    const [lo, hi] = SPAWN_CONFIG.archerShotSeconds;
    mob.aimTime = 0;
    mob.shotDelay = lo + Math.random() * (hi - lo);
    mob.attackAnim = 0;
    ctx.shootArrow(mob, t);
  }
}

/** Optional: undead mobs smoulder in direct sunlight. */
function burn(mob: Mob, dt: number, ctx: AIContext) {
  mob.burning = false;
  if (!SPAWN_CONFIG.burnInSunlight || !mob.def.burns || !ctx.isDay || mob.inWater) return;
  const light = ctx.lightAt(Math.floor(mob.pos.x), Math.floor(mob.pos.y + mob.height - 0.1), Math.floor(mob.pos.z));
  if (light >> 4 < 15) return;
  mob.burning = true;
  mob.burnTimer += dt;
  if (mob.burnTimer >= SPAWN_CONFIG.sunBurnInterval) {
    mob.burnTimer = 0;
    mob.hurt(SPAWN_CONFIG.sunBurnDamage, { weapon: -1 });
  }
}

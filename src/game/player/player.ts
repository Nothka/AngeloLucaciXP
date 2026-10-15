import * as THREE from "three";
import { B, isWater, waterHeight16 } from "../world/blocks";
import { solidTester, sweepAxis, type SolidAt } from "../entities/physics";
import type { World } from "../world/world";
import { IS_MAC, type Input } from "../input/input";

export type GameMode = "survival" | "creative";

const WALK = 4.317;
const SPRINT = 5.612;
const SNEAK = 1.31;
const SWIM = 2.2;
const FLY = 10.9;
const FLY_SPRINT = 21.8;
const FLY_VERTICAL = 7.5;
const GRAVITY = 32;
const TERMINAL = 78.4;
const JUMP = 8.9;
const STEP = 1 / 60;

export { IS_MAC };

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
const HALF = PLAYER_WIDTH / 2;
const EPS = 1e-4;

/** First-person player with axis-separated AABB collision against solid blocks. */
export class Player {
  readonly pos = new THREE.Vector3();
  readonly prevPos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  mode: GameMode = "survival";
  onGround = false;
  inWater = false;
  headInWater = false;
  flying = false;
  sneaking = false;
  sprinting = false;
  /** Distance walked on the ground, for view bobbing and footsteps. */
  walkDist = 0;
  horizontalCollision = false;
  fallStart = 0;
  onStep: ((block: number) => void) | null = null;
  /** Distances and jumps since last read; hunger is drained from these. */
  readonly exertion = { sprint: 0, swim: 0, jumps: 0, sprintJumps: 0 };
  onLand: ((block: number, fall: number) => void) | null = null;
  private accumulator = 0;
  private stepDist = 0;

  /** Collision box, in the shape the shared physics expects. */
  readonly half = PLAYER_WIDTH / 2;
  readonly height = PLAYER_HEIGHT;
  private readonly solid: SolidAt;

  constructor(private world: World) {
    this.solid = solidTester(world);
  }

  get eyeHeight() {
    return this.sneaking && !this.flying ? 1.5 : 1.62;
  }

  eye(out = new THREE.Vector3(), alpha = 1) {
    out.lerpVectors(this.prevPos, this.pos, alpha);
    out.y += this.eyeHeight;
    return out;
  }

  look(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  teleport(x: number, y: number, z: number) {
    this.pos.set(x, y, z);
    this.prevPos.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.fallStart = y;
  }

  /** Mouse look. Sensitivity 1 = 0.0022 rad per mouse count. */
  applyLook(input: Input, sensitivity: number) {
    const k = 0.0022 * sensitivity;
    this.yaw -= input.mouseDX * k;
    this.pitch = Math.max(-Math.PI / 2 + 0.001, Math.min(Math.PI / 2 - 0.001, this.pitch - input.mouseDY * k));
  }

  update(dt: number, input: Input, controlsEnabled: boolean) {
    const keys = controlsEnabled ? input.keys : new Set<string>();
    if (controlsEnabled && this.mode === "creative" && input.doubleTapped("Space")) {
      this.flying = !this.flying;
      if (this.flying) this.vel.y = 0;
    }
    if (this.mode !== "creative") this.flying = false;

    const forward = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const strafe = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    this.sneaking = !this.flying && (keys.has("ShiftLeft") || keys.has("ShiftRight"));
    // Not Ctrl: Ctrl+W closes the tab on Windows/Linux, and Control-click is right click on a Mac.
    const sprintKey = keys.has("AltLeft") || keys.has("AltRight");
    if (forward > 0 && (sprintKey || (controlsEnabled && input.doubleTapped("KeyW"))) && !this.sneaking) this.sprinting = true;
    if (forward <= 0 || this.sneaking || (this.horizontalCollision && !this.flying)) this.sprinting = false;

    this.accumulator = Math.min(this.accumulator + dt, 0.25);
    while (this.accumulator >= STEP) {
      this.accumulator -= STEP;
      this.prevPos.copy(this.pos);
      this.step(STEP, forward, strafe, keys.has("Space"), this.sneaking || keys.has("ShiftLeft"));
    }
  }

  /** Fraction of a physics step left over, for interpolating the camera between steps. */
  get alpha() {
    return this.accumulator / STEP;
  }

  private step(dt: number, forward: number, strafe: number, jump: boolean, down: boolean) {
    this.updateWaterState();
    let speed: number;
    if (this.flying) speed = this.sprinting ? FLY_SPRINT : FLY;
    else if (this.inWater) speed = SWIM * (this.sprinting ? 1.3 : 1);
    else if (this.sneaking) speed = SNEAK;
    else speed = this.sprinting ? SPRINT : WALK;

    // Desired horizontal velocity from input, rotated by yaw.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wx = -sin * forward + cos * strafe;
    let wz = -cos * forward - sin * strafe;
    const len = Math.hypot(wx, wz);
    if (len > 1) { wx /= len; wz /= len; }
    const accel = this.flying ? 6 : this.onGround ? 14 : this.inWater ? 6 : 2.2;
    const k = 1 - Math.exp(-accel * dt);
    this.vel.x += (wx * speed - this.vel.x) * k;
    this.vel.z += (wz * speed - this.vel.z) * k;

    if (this.flying) {
      const vy = (jump ? 1 : 0) - (down ? 1 : 0);
      this.vel.y += (vy * FLY_VERTICAL - this.vel.y) * (1 - Math.exp(-10 * dt));
    } else if (this.inWater) {
      this.vel.y -= 9 * dt;
      this.vel.y *= Math.exp(-2.5 * dt);
      if (jump) {
        this.vel.y = Math.min(this.vel.y + 22 * dt, 3.2);
        if (this.horizontalCollision && !this.headInWater) this.vel.y = 6.5;
      }
      this.vel.y = Math.max(this.vel.y, -4);
    } else {
      if (jump && this.onGround) {
        this.vel.y = JUMP;
        if (this.sprinting) this.exertion.sprintJumps++;
        else this.exertion.jumps++;
        if (this.sprinting) {
          this.vel.x += -sin * 1.2;
          this.vel.z += -cos * 1.2;
        }
      }
      this.vel.y = Math.max(this.vel.y - GRAVITY * dt, -TERMINAL);
    }

    const wasOnGround = this.onGround;
    this.onGround = false;
    this.horizontalCollision = false;
    const dy = this.vel.y * dt;
    this.moveAxis(1, dy);
    const guard = this.sneaking && wasOnGround && !this.flying;
    let dx = this.vel.x * dt;
    let dz = this.vel.z * dt;
    if (guard) {
      if (dx && !this.groundBelow(this.pos.x + dx, this.pos.z)) { dx = 0; this.vel.x = 0; }
      if (dz && !this.groundBelow(this.pos.x + dx, this.pos.z + dz)) { dz = 0; this.vel.z = 0; }
    }
    const bx = this.pos.x;
    const bz = this.pos.z;
    this.moveAxis(0, dx);
    this.moveAxis(2, dz);
    const horizontal = Math.hypot(this.pos.x - bx, this.pos.z - bz);
    if (this.inWater) this.exertion.swim += horizontal;
    else if (this.sprinting && this.onGround) this.exertion.sprint += horizontal;

    if (this.flying && this.onGround) this.flying = false;
    if (this.onGround) {
      if (!wasOnGround) this.onLand?.(this.blockUnderfoot(), this.fallStart - this.pos.y);
      this.fallStart = this.pos.y;
      const moved = Math.hypot(this.pos.x - bx, this.pos.z - bz);
      this.walkDist += moved;
      this.stepDist += moved;
      if (this.stepDist > (this.sprinting ? 2.0 : 1.7)) {
        this.stepDist = 0;
        this.onStep?.(this.blockUnderfoot());
      }
    } else if (this.flying || this.inWater || this.pos.y > this.fallStart) {
      this.fallStart = this.pos.y;
    }
  }

  /** What the feet are on: a snow layer in the feet's own cell counts, otherwise the block below. */
  private blockUnderfoot() {
    const x = Math.floor(this.pos.x), z = Math.floor(this.pos.z);
    const feet = this.world.getBlock(x, Math.floor(this.pos.y + 0.01), z);
    if (feet === B.SNOW_LAYER) return feet;
    return this.world.getBlock(x, Math.floor(this.pos.y - 0.1), z);
  }

  private solidAt(x: number, y: number, z: number) {
    return this.solid(x, y, z);
  }

  private groundBelow(px: number, pz: number) {
    const y = Math.floor(this.pos.y - 0.05);
    for (let x = Math.floor(px - HALF + EPS); x <= Math.floor(px + HALF - EPS); x++) {
      for (let z = Math.floor(pz - HALF + EPS); z <= Math.floor(pz + HALF - EPS); z++) {
        if (this.solidAt(x, y, z)) return true;
      }
    }
    return false;
  }

  /** Moves along one axis with the AABB sweep shared with mobs. */
  private moveAxis(axis: 0 | 1 | 2, delta: number) {
    sweepAxis(this, axis, delta, this.solid);
  }

  private updateWaterState() {
    const x = Math.floor(this.pos.x);
    const z = Math.floor(this.pos.z);
    const feet = this.waterAt(x, this.pos.y + 0.1, z);
    const body = this.waterAt(x, this.pos.y + 0.8, z);
    this.inWater = !this.flying && (feet || body);
    this.headInWater = this.waterAt(x, this.pos.y + this.eyeHeight, z);
  }

  /** True if (x, y, z) is under the water surface, honouring partial flowing levels. */
  waterAt(x: number, y: number, z: number) {
    const by = Math.floor(y);
    const id = this.world.getBlock(x, by, z);
    if (!isWater(id)) return false;
    return y - by < waterHeight16(id, this.world.getBlock(x, by + 1, z)) / 16;
  }

  /** True if a block at (x,y,z) would overlap the player's body. */
  intersectsBlock(x: number, y: number, z: number) {
    const p = this.pos;
    return x + 1 > p.x - HALF && x < p.x + HALF && y + 1 > p.y && y < p.y + PLAYER_HEIGHT && z + 1 > p.z - HALF && z < p.z + HALF;
  }
}

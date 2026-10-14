import * as THREE from "three";
import { BLOCKS, B, getItem, supportDir, supports } from "../world/blocks";
import { placementFor } from "../world/placement";
import type { World } from "../world/world";
import type { Input } from "../input/input";
import type { Player } from "./player";
import { raycast, type RayHit } from "./raycast";
import type { Attackable } from "../items/combat";

export interface InteractionHost {
  /** Nearest attackable entity along the view ray, if any. */
  pickEntity?(eye: THREE.Vector3, dir: THREE.Vector3, reach: number): { target: Attackable; dist: number } | null;
  attackEntity?(target: Attackable): void;
  /** Right-click on an entity (feeding animals); return true if it was used. */
  useEntity?(target: Attackable): boolean;
  /** True if a mob stands in the cell, so blocks are not placed inside it. */
  blockedByEntity?(x: number, y: number, z: number): boolean;
  heldItem(): number;
  consumeHeld(): void;
  onBlockBroken(x: number, y: number, z: number, id: number, harvested: boolean): void;
  onBlockPlaced(x: number, y: number, z: number, id: number): void;
  /** Right-click on a block; return true when the click was used (e.g. opening a crafting table). */
  onUseBlock(x: number, y: number, z: number, id: number): boolean;
  onSwing(): void;
  onDigTick(id: number): void;
  /**
   * Items with their own right-click action (hoes, buckets, rods). Called
   * even when no block is targeted; return true if the click was used.
   */
  useItem?(hit: RayHit | null): boolean;
}

/** Seconds to break `id` holding `held`, following the classic hardness rules. */
export function breakTime(id: number, held: number): { time: number; harvest: boolean } {
  const def = BLOCKS[id];
  if (!def || def.hardness < 0) return { time: Infinity, harvest: false };
  const tool = getItem(held)?.tool;
  const correct = !!tool && def.tool === tool.type;
  // The right kind of tool, and a good enough material for ores like iron and diamond.
  const harvest = !def.needsTool || (correct && tool!.tier >= def.minTier);
  if (def.hardness === 0) return { time: 0, harvest };
  const speed = correct ? tool!.speed : 1;
  return { time: (def.hardness * (harvest ? 1.5 : 5)) / speed, harvest };
}

export class Interaction {
  target: RayHit | null = null;
  entityTarget: Attackable | null = null;
  progress = 0;
  private breakKey = "";
  private breakCooldown = 0;
  private placeCooldown = 0;
  /** A click blocked only by the player's own body is retried for a moment (pillar jumping). */
  private pendingPlace = 0;
  private digSoundTimer = 0;
  private readonly eye = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();

  constructor(private world: World, private player: Player, private host: InteractionHost) {}

  get reach() {
    return this.player.mode === "creative" ? 5 : 4.5;
  }

  update(dt: number, input: Input, enabled: boolean) {
    this.player.eye(this.eye, this.player.alpha);
    this.player.look(this.dir);
    this.target = raycast(this.world, this.eye, this.dir, this.reach);
    // A mob in front of the targeted block takes the click instead of the block.
    const entity = this.host.pickEntity?.(this.eye, this.dir, this.reach) ?? null;
    this.entityTarget = entity && (!this.target || entity.dist < this.target.dist) ? entity.target : null;
    if (this.entityTarget) this.target = null;
    this.breakCooldown = Math.max(0, this.breakCooldown - dt);
    this.placeCooldown = Math.max(0, this.placeCooldown - dt);
    this.pendingPlace = Math.max(0, this.pendingPlace - dt);

    if (!enabled) {
      this.progress = 0;
      this.breakKey = "";
      return;
    }

    if (this.entityTarget) {
      this.progress = 0;
      this.breakKey = "";
      if (input.clicked.has(0)) {
        this.host.attackEntity?.(this.entityTarget);
        this.host.onSwing();
      }
      if (input.clicked.has(2) && this.host.useEntity?.(this.entityTarget)) input.buttons.delete(2);
      return;
    }

    const hit = this.target;
    // ---- breaking (hold left)
    const leftDown = input.buttons.has(0) || input.clicked.has(0);
    const rightDown = input.buttons.has(2) || input.clicked.has(2);
    if (leftDown && hit) {
      const key = `${hit.x},${hit.y},${hit.z}`;
      if (key !== this.breakKey) {
        this.breakKey = key;
        this.progress = 0;
      }
      if (this.breakCooldown <= 0) {
        if (input.clicked.has(0) || this.progress > 0 || this.player.mode === "creative") this.host.onSwing();
        if (this.player.mode === "creative") {
          this.breakBlock(hit, true);
          this.breakCooldown = 0.25;
        } else {
          const { time, harvest } = breakTime(hit.id, this.host.heldItem());
          if (time !== Infinity) {
            this.progress += time === 0 ? 1 : dt / time;
            this.digSoundTimer -= dt;
            if (this.digSoundTimer <= 0 && time > 0) {
              this.host.onDigTick(hit.id);
              this.digSoundTimer = 0.25;
            }
            if (this.progress >= 1) {
              this.breakBlock(hit, harvest);
              this.progress = 0;
              this.breakKey = "";
              this.breakCooldown = time === 0 ? 0.05 : 0.25;
            }
          }
        }
      }
    } else {
      this.progress = 0;
      this.breakKey = "";
      if (input.clicked.has(0)) this.host.onSwing();
    }

    // ---- using / placing (right click, repeats while held)
    if (rightDown && (input.clicked.has(2) || this.placeCooldown <= 0)) {
      this.placeCooldown = 0.25;
      if (hit && !this.player.sneaking && this.host.onUseBlock(hit.x, hit.y, hit.z, hit.id)) {
        input.buttons.delete(2);
        return;
      }
      if (this.host.useItem?.(hit)) {
        input.buttons.delete(2);
        return;
      }
      if (!hit) return;
      const result = this.tryPlace(hit);
      if (result === "blocked-by-player") {
        // Jumping to place a block underneath: try again every frame until the body clears the cell.
        this.placeCooldown = 0;
        if (input.clicked.has(2)) this.pendingPlace = 0.45;
      } else {
        this.pendingPlace = 0;
      }
    } else if (this.pendingPlace > 0 && hit && !rightDown) {
      if (this.tryPlace(hit) !== "blocked-by-player") this.pendingPlace = 0;
    }
  }

  private breakBlock(hit: RayHit, harvest: boolean) {
    const { x, y, z, id } = hit;
    if (!this.world.setBlock(x, y, z, B.AIR)) return;
    // Anything that was hanging on this block pops off via the world's support rules.
    this.host.onBlockBroken(x, y, z, id, harvest && this.player.mode === "survival");
  }

  private tryPlace(hit: RayHit): "placed" | "blocked-by-player" | "invalid" {
    const plan = placementFor(this.host.heldItem(), hit, this.player.yaw);
    if (!plan) return "invalid";
    for (let i = 0; i < plan.length; i++) {
      const { x, y, z, id } = plan[i];
      if (y < 0 || y >= 128) return "invalid";
      if (!BLOCKS[this.world.getBlock(x, y, z)]?.replaceable) return "invalid";
      const def = BLOCKS[id];
      if (def.solid && this.player.intersectsBlock(x, y, z)) return "blocked-by-player";
      if (def.solid && this.host.blockedByEntity?.(x, y, z)) return "invalid";
      // Every block must hang on something real (later cells may rest on earlier ones).
      const dir = supportDir(id);
      if (dir && i === 0 && !supports(id, this.world.getBlock(x + dir[0], y + dir[1], z + dir[2]))) return "invalid";
    }
    for (const { x, y, z, id } of plan) this.world.setBlock(x, y, z, id);
    this.host.onSwing();
    this.host.onBlockPlaced(plan[0].x, plan[0].y, plan[0].z, plan[0].id);
    if (this.player.mode === "survival") this.host.consumeHeld();
    return "placed";
  }
}

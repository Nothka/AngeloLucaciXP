import * as THREE from "three";
import { IS_SOLID, isWater } from "../world/blocks";

export interface FishingWorld {
  getBlock(x: number, y: number, z: number): number;
}

export type ReelResult = "fish" | "nothing" | "snagged";

/**
 * A fishing bobber. Cast it into water and wait: after a random time a fish
 * bites and the bobber dips for a moment. Reeling in during the dip catches
 * it; too early or too late catches nothing.
 */
export class FishingBobber {
  readonly group = new THREE.Group();
  readonly pos = new THREE.Vector3();
  private vel = new THREE.Vector3();
  private line: THREE.Line;
  private lineGeo = new THREE.BufferGeometry();
  private float: THREE.Mesh;
  inWater = false;
  onGround = false;
  /** Seconds until a fish bites, once floating. */
  private wait = 0;
  /** Seconds left in the current bite (the window to reel in). */
  bite = 0;
  private age = 0;
  /** Called when a fish takes the bait (for a splash sound). */
  onBite: (() => void) | null = null;
  onSplash: (() => void) | null = null;

  constructor(from: THREE.Vector3, dir: THREE.Vector3, private rain = false) {
    this.pos.copy(from);
    this.vel.copy(dir).multiplyScalar(13);
    this.vel.y += 2.5;
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.14), new THREE.MeshBasicMaterial({ color: 0xd8321e }));
    top.position.y = 0.06;
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.14), new THREE.MeshBasicMaterial({ color: 0xf1efe6 }));
    bottom.position.y = -0.02;
    this.float = new THREE.Mesh();
    this.float.add(top, bottom);
    this.lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    this.line = new THREE.Line(this.lineGeo, new THREE.LineBasicMaterial({ color: 0x1b1b1b }));
    this.line.frustumCulled = false;
    this.group.add(this.float, this.line);
    this.resetWait();
  }

  private resetWait() {
    // Rain makes the fish bite sooner, as in the classic game.
    this.wait = (5 + Math.random() * 20) * (this.rain ? 0.75 : 1);
  }

  /** Returns false when the bobber should be removed (too far, or stuck for ages). */
  update(dt: number, w: FishingWorld, rodTip: THREE.Vector3): boolean {
    this.age += dt;
    const bx = Math.floor(this.pos.x), by = Math.floor(this.pos.y), bz = Math.floor(this.pos.z);
    const here = w.getBlock(bx, by, bz);
    const wasInWater = this.inWater;
    this.inWater = isWater(here);
    if (this.inWater && !wasInWater && this.age > 0.1) this.onSplash?.();
    if (this.inWater) {
      // Bob at the surface.
      let surface = by + 1;
      while (isWater(w.getBlock(bx, surface, bz)) && surface < by + 4) surface++;
      const target = surface - 0.12 - (this.bite > 0 ? 0.25 : 0);
      this.vel.y += (target - this.pos.y) * 30 * dt - this.vel.y * 6 * dt;
      this.vel.x *= Math.exp(-4 * dt);
      this.vel.z *= Math.exp(-4 * dt);
      if (this.bite > 0) {
        this.bite -= dt;
        if (this.bite <= 0) this.resetWait();
      } else {
        this.wait -= dt;
        if (this.wait <= 0) {
          this.bite = 0.9;
          this.vel.y -= 2.5;
          this.onBite?.();
        }
      }
    } else if (!this.onGround) {
      this.vel.y -= 20 * dt;
    }
    if (!this.onGround) {
      const next = this.pos.clone().addScaledVector(this.vel, dt);
      if (IS_SOLID[w.getBlock(Math.floor(next.x), Math.floor(next.y - 0.05), Math.floor(next.z))]) {
        this.onGround = true;
        this.vel.set(0, 0, 0);
        this.pos.y = Math.floor(next.y - 0.05) + 1.05;
      } else {
        this.pos.copy(next);
      }
    }
    this.float.position.copy(this.pos);
    const a = this.lineGeo.attributes.position as THREE.BufferAttribute;
    a.setXYZ(0, rodTip.x, rodTip.y, rodTip.z);
    a.setXYZ(1, this.pos.x, this.pos.y + 0.1, this.pos.z);
    a.needsUpdate = true;
    return this.pos.distanceTo(rodTip) < 32 && this.pos.y > -10 && this.age < 300;
  }

  /** Reel in: a catch if a fish is biting right now. */
  reel(): ReelResult {
    if (this.inWater && this.bite > 0) return "fish";
    return this.onGround ? "snagged" : "nothing";
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
  }
}

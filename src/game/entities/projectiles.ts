import * as THREE from "three";
import { Pixels } from "../render/textures";
import { rayAABB } from "../player/raycast";
import type { Mob } from "./mob";
import type { SolidAt } from "./physics";

export interface ArrowOptions {
  fromPlayer: boolean;
  shooter: Mob | null;
  damage: number;
  /** Can be collected once it sticks in a block. */
  pickup: boolean;
}

interface Arrow extends ArrowOptions {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  stuck: boolean;
  stuckTime: number;
  mesh: THREE.Mesh;
}

export interface ProjectileHooks {
  /** The player's collision box (feet position, half width, height), or null when untargetable. */
  player(): { x: number; y: number; z: number; half: number; height: number } | null;
  hitPlayer(damage: number, from: THREE.Vector3): void;
  mobs(): Iterable<Mob>;
  hitMob(mob: Mob, damage: number, from: THREE.Vector3): void;
  /** Returns true if the arrow went into the inventory. */
  pickup(): boolean;
  thud(x: number, y: number, z: number): void;
}

const GRAVITY = 20;
const STUCK_SECONDS = 30;

function arrowMesh(): { geometry: THREE.BufferGeometry; material: THREE.Material } {
  const p = new Pixels();
  for (let x = 3; x < 14; x++) { p.set(x, 7, "#8a6339"); p.set(x, 8, "#6b4a2a"); }
  for (const [x, y] of [[14, 7], [14, 8], [15, 7], [15, 8], [13, 6], [13, 9]]) p.set(x, y, "#9c9c9c");
  for (const [x, y] of [[0, 5], [1, 6], [2, 6], [0, 10], [1, 9], [2, 9], [1, 7], [1, 8], [0, 7], [0, 8], [3, 6], [3, 9]]) p.set(x, y, "#f2f0ea");
  const tex = new THREE.CanvasTexture(p.toCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide });
  // Two crossed planes along +Z; the sprite's +X (the tip) points forward.
  const a = new THREE.PlaneGeometry(0.6, 0.6);
  a.rotateY(-Math.PI / 2);
  const b = a.clone();
  b.rotateZ(Math.PI / 2);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([...a.getAttribute("position").array, ...b.getAttribute("position").array], 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute([...a.getAttribute("uv").array, ...b.getAttribute("uv").array], 2));
  geometry.setIndex([...a.getIndex()!.array, ...[...b.getIndex()!.array].map((i) => i + 4)]);
  return { geometry, material };
}

/** Arrows in flight and stuck in blocks. */
export class ProjectileManager {
  readonly group = new THREE.Group();
  private arrows: Arrow[] = [];
  private shape = arrowMesh();
  private tmp = new THREE.Vector3();
  private dir = new THREE.Vector3();

  get count() {
    return this.arrows.length;
  }

  shoot(from: THREE.Vector3, vel: THREE.Vector3, opts: ArrowOptions) {
    const mesh = new THREE.Mesh(this.shape.geometry, this.shape.material);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    const arrow: Arrow = { ...opts, pos: from.clone(), vel: vel.clone(), age: 0, stuck: false, stuckTime: 0, mesh };
    this.orient(arrow);
    this.arrows.push(arrow);
  }

  private orient(a: Arrow) {
    a.mesh.position.copy(a.pos);
    if (a.vel.lengthSq() > 1e-6) a.mesh.lookAt(this.tmp.copy(a.pos).add(a.vel));
  }

  private remove(a: Arrow) {
    this.group.remove(a.mesh);
    this.arrows.splice(this.arrows.indexOf(a), 1);
  }

  update(dt: number, solidAt: SolidAt, hooks: ProjectileHooks) {
    const player = hooks.player();
    for (const a of [...this.arrows]) {
      a.age += dt;
      if (a.stuck) {
        a.stuckTime += dt;
        if (a.stuckTime > STUCK_SECONDS) this.remove(a);
        else if (a.pickup && player && a.stuckTime > 0.4 && Math.abs(a.pos.x - player.x) < 1.2 && Math.abs(a.pos.z - player.z) < 1.2 && a.pos.y > player.y - 0.5 && a.pos.y < player.y + player.height + 0.5) {
          if (hooks.pickup()) this.remove(a);
        }
        continue;
      }
      if (a.age > 20) {
        this.remove(a);
        continue;
      }
      a.vel.y -= GRAVITY * dt;
      a.vel.multiplyScalar(Math.exp(-0.15 * dt));
      const step = a.vel.length() * dt;
      this.dir.copy(a.vel).normalize();

      // Earliest of: a block, a mob, the player.
      let hitT = Infinity;
      let hitKind: "block" | "mob" | "player" | null = null;
      let hitMob: Mob | null = null;
      for (let t = 0.05; t <= step + 1e-6; t += 0.08) {
        const x = a.pos.x + this.dir.x * t, y = a.pos.y + this.dir.y * t, z = a.pos.z + this.dir.z * t;
        if (solidAt(Math.floor(x), Math.floor(y), Math.floor(z))) {
          hitT = Math.max(0, t - 0.08);
          hitKind = "block";
          break;
        }
      }
      for (const mob of hooks.mobs()) {
        if (mob === a.shooter || mob.dead) continue;
        const t = rayAABB(a.pos, this.dir, mob.pos.x - mob.half, mob.pos.y, mob.pos.z - mob.half, mob.pos.x + mob.half, mob.pos.y + mob.height, mob.pos.z + mob.half);
        if (t !== null && t <= step && t < hitT) { hitT = t; hitKind = "mob"; hitMob = mob; }
      }
      if (player && !a.fromPlayer) {
        const t = rayAABB(a.pos, this.dir, player.x - player.half, player.y, player.z - player.half, player.x + player.half, player.y + player.height, player.z + player.half);
        if (t !== null && t <= step && t < hitT) { hitT = t; hitKind = "player"; }
      }

      if (hitKind === "mob" && hitMob) {
        hooks.hitMob(hitMob, a.damage, a.pos.clone().sub(this.dir));
        this.remove(a);
      } else if (hitKind === "player") {
        hooks.hitPlayer(a.damage, a.pos.clone().sub(this.dir));
        this.remove(a);
      } else if (hitKind === "block") {
        a.pos.addScaledVector(this.dir, hitT + 0.15);
        a.stuck = true;
        a.mesh.position.copy(a.pos);
        hooks.thud(a.pos.x, a.pos.y, a.pos.z);
      } else {
        a.pos.addScaledVector(a.vel, dt);
        this.orient(a);
      }
    }
  }

  clear() {
    for (const a of [...this.arrows]) this.remove(a);
  }
}

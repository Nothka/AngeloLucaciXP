import * as THREE from "three";
import { Pixels } from "../render/textures";
import type { SolidAt } from "./physics";

interface Orb {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  value: number;
  age: number;
  sprite: THREE.Sprite;
}

/** Orb sizes by value, like the classic little-to-large green sparks. */
const SIZES = [1, 3, 7, 17, 37];

function orbTexture() {
  const p = new Pixels(8, 8);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x - 3.5, y - 3.5);
      if (d < 1.6) p.set(x, y, "#f6ffb0");
      else if (d < 2.6) p.set(x, y, "#b6f23c");
      else if (d < 3.6) p.set(x, y, "#4f9a12", 230);
    }
  }
  const tex = new THREE.CanvasTexture(p.toCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Experience orbs: pop out, settle, then home in on the player within 8 blocks. */
export class XpOrbManager {
  readonly group = new THREE.Group();
  private orbs: Orb[] = [];
  private material = new THREE.SpriteMaterial({ map: orbTexture(), transparent: true, depthWrite: false, fog: false });

  get count() {
    return this.orbs.length;
  }

  /** Splits `points` into a few orbs. */
  spawn(points: number, x: number, y: number, z: number) {
    let left = Math.max(0, Math.floor(points));
    while (left > 0) {
      const value = [...SIZES].reverse().find((s) => s <= left) ?? 1;
      left -= value;
      const sprite = new THREE.Sprite(this.material.clone());
      const size = 0.18 + Math.min(4, SIZES.indexOf(value)) * 0.05;
      sprite.scale.setScalar(size);
      this.group.add(sprite);
      this.orbs.push({
        pos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3((Math.random() - 0.5) * 3, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 3),
        value,
        age: 0,
        sprite,
      });
    }
  }

  /** `collect` receives each orb's value as it reaches the player. */
  update(dt: number, solidAt: SolidAt, target: THREE.Vector3 | null, collect: (value: number) => void, time: number) {
    for (const orb of [...this.orbs]) {
      orb.age += dt;
      if (orb.age > 300 || orb.pos.y < -64) {
        this.remove(orb);
        continue;
      }
      const toPlayer = target ? target.clone().sub(orb.pos) : null;
      const dist = toPlayer ? toPlayer.length() : Infinity;
      if (toPlayer && orb.age > 0.6 && dist < 8) {
        // Pull grows as the orb gets closer.
        const pull = (1 - dist / 8) ** 2 * 40;
        orb.vel.addScaledVector(toPlayer.normalize(), pull * dt);
        orb.vel.multiplyScalar(Math.exp(-2 * dt));
        if (dist < 0.7) {
          collect(orb.value);
          this.remove(orb);
          continue;
        }
      } else {
        orb.vel.y -= 16 * dt;
        orb.vel.x *= Math.exp(-2 * dt);
        orb.vel.z *= Math.exp(-2 * dt);
      }
      const next = orb.pos.clone().addScaledVector(orb.vel, dt);
      if (solidAt(Math.floor(next.x), Math.floor(next.y - 0.1), Math.floor(next.z)) && orb.vel.y < 0) {
        next.y = Math.floor(next.y - 0.1) + 1.1;
        orb.vel.y = 0;
      }
      orb.pos.copy(next);
      orb.sprite.position.copy(orb.pos);
      // A slow green-to-yellow shimmer.
      const s = 0.5 + 0.5 * Math.sin(time * 4 + orb.age * 3);
      (orb.sprite.material as THREE.SpriteMaterial).color.setRGB(0.7 + 0.3 * s, 1, 0.5 + 0.2 * s);
    }
  }

  private remove(orb: Orb) {
    this.group.remove(orb.sprite);
    orb.sprite.material.dispose();
    this.orbs.splice(this.orbs.indexOf(orb), 1);
  }

  clear() {
    for (const o of [...this.orbs]) this.remove(o);
  }
}

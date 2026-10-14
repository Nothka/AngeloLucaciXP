import * as THREE from "three";
import { IS_SOLID } from "../world/blocks";
import type { World } from "../world/world";
import type { Player } from "../player/player";
import { createItemModel, type ItemModel } from "../render/itemMeshes";
import { isFlatItem } from "../render/items";

interface Drop {
  id: number;
  count: number;
  wear?: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  pickupDelay: number;
  spin: number;
  model: ItemModel;
}

const MAX_DROPS = 160;
const DESPAWN = 300;

/** Items lying in the world: they fall, settle, bob and fly to the player when close. */
export class DropManager {
  readonly group = new THREE.Group();
  private drops: Drop[] = [];

  constructor(private world: World, private entityMaterial: () => THREE.ShaderMaterial) {}

  get count() {
    return this.drops.length;
  }

  spawn(id: number, count: number, x: number, y: number, z: number, vel?: THREE.Vector3, pickupDelay = 0.5, wear?: number) {
    if (this.drops.length >= MAX_DROPS) this.remove(this.drops[0]);
    const model = createItemModel(id, this.entityMaterial);
    model.object.scale.setScalar(isFlatItem(id) ? 0.4 : 0.25);
    this.group.add(model.object);
    this.drops.push({
      id,
      count,
      wear,
      pos: new THREE.Vector3(x, y, z),
      vel: vel ?? new THREE.Vector3((Math.random() - 0.5) * 2, 3.2, (Math.random() - 0.5) * 2),
      age: 0,
      pickupDelay,
      spin: Math.random() * Math.PI * 2,
      model,
    });
  }

  private remove(drop: Drop) {
    this.group.remove(drop.model.object);
    drop.model.dispose();
    this.drops.splice(this.drops.indexOf(drop), 1);
  }

  private solid(x: number, y: number, z: number) {
    return IS_SOLID[this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z))] === 1;
  }

  /** `pickup` returns how many items did not fit in the inventory. */
  update(dt: number, player: Player, daylight: number, pickup: (id: number, count: number, wear?: number) => number) {
    const target = new THREE.Vector3(player.pos.x, player.pos.y + 0.8, player.pos.z);
    for (const drop of [...this.drops]) {
      drop.age += dt;
      drop.spin += dt * 1.6;
      if (drop.age > DESPAWN || drop.pos.y < -10) {
        this.remove(drop);
        continue;
      }
      const toPlayer = target.clone().sub(drop.pos);
      const dist = toPlayer.length();
      const inReach =
        Math.abs(drop.pos.x - player.pos.x) < 1.3 &&
        Math.abs(drop.pos.z - player.pos.z) < 1.3 &&
        drop.pos.y > player.pos.y - 0.5 &&
        drop.pos.y < player.pos.y + 2.3;
      if (drop.age > drop.pickupDelay && (inReach || dist < 1.8)) {
        // Magnet: slide straight into the player.
        drop.pos.addScaledVector(toPlayer.normalize(), Math.min(dist, dt * 9));
        if (dist < 0.6) {
          const left = pickup(drop.id, drop.count, drop.wear);
          if (left === drop.count) {
            // Refused (inventory full or player dead): stop magnetising for a moment.
            drop.pickupDelay = drop.age + 1;
            continue;
          }
          if (left <= 0) {
            this.remove(drop);
            continue;
          }
          drop.count = left;
        }
      } else {
        drop.vel.y = Math.max(drop.vel.y - 20 * dt, -30);
        const next = drop.pos.clone().addScaledVector(drop.vel, dt);
        const half = 0.12;
        if (this.solid(next.x, next.y - half, next.z)) {
          next.y = Math.floor(next.y - half) + 1 + half;
          drop.vel.y = 0;
          drop.vel.x *= Math.exp(-10 * dt);
          drop.vel.z *= Math.exp(-10 * dt);
        }
        if (this.solid(next.x, next.y, drop.pos.z)) { next.x = drop.pos.x; drop.vel.x = 0; }
        if (this.solid(drop.pos.x, next.y, next.z)) { next.z = drop.pos.z; drop.vel.z = 0; }
        // Pushed up and out if a block was placed on top of the item.
        if (this.solid(next.x, next.y, next.z)) next.y = Math.floor(next.y) + 1 + half;
        drop.pos.copy(next);
      }
      const bob = Math.sin(drop.age * 2.5 + drop.spin) * 0.06 + 0.1;
      drop.model.object.position.set(drop.pos.x, drop.pos.y + bob, drop.pos.z);
      drop.model.object.rotation.y = drop.spin;
      drop.model.setLight(this.world.getLight(Math.floor(drop.pos.x), Math.floor(drop.pos.y), Math.floor(drop.pos.z)), daylight);
    }
  }

  clear() {
    for (const drop of [...this.drops]) this.remove(drop);
  }
}

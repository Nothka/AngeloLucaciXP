import * as THREE from "three";
import { blockItemGeometry } from "../render/itemMeshes";
import { BLOCKS, B, isWater } from "./blocks";
import { isFlowable } from "./fluid";
import type { World } from "./world";

interface Falling {
  id: number;
  x: number;
  z: number;
  /** Height of the block's underside. */
  y: number;
  vy: number;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
}

/** Cells a falling block can drop through. */
export const passable = (id: number) => isFlowable(id) || isWater(id);

/**
 * Sand and gravel: when the cell under one opens up it becomes a falling
 * block entity, then turns back into a block wherever it lands.
 */
export class FallingBlocks {
  readonly group = new THREE.Group();
  private list: Falling[] = [];

  constructor(
    private world: World,
    private entityMaterial: () => THREE.ShaderMaterial,
    /** Called when it lands somewhere it cannot sit (e.g. on a torch): drop it as an item. */
    private dropItem: (id: number, x: number, y: number, z: number) => void,
  ) {}

  get count() {
    return this.list.length;
  }

  /** If the block at (x,y,z) obeys gravity and has nothing under it, start it falling. */
  check(x: number, y: number, z: number) {
    const id = this.world.getBlock(x, y, z);
    if (!BLOCKS[id]?.gravity || y <= 0) return;
    if (!passable(this.world.getBlock(x, y - 1, z))) return;
    this.world.setBlock(x, y, z, B.AIR);
    const material = this.entityMaterial();
    const mesh = new THREE.Mesh(blockItemGeometry(id), material);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.list.push({ id, x, z, y, vy: 0, mesh, material });
  }

  update(dt: number) {
    for (const f of [...this.list]) {
      f.vy = Math.max(f.vy - 32 * dt, -40);
      const next = f.y + f.vy * dt;
      const cell = Math.floor(next);
      const below = this.world.getBlock(f.x, cell, f.z);
      if (cell < -64) {
        // Fell out of the world.
        this.remove(f);
        continue;
      }
      if (cell >= 0 && !passable(below)) {
        // Landed on top of `cell`.
        const ly = Math.max(0, cell + 1);
        const here = this.world.getBlock(f.x, ly, f.z);
        if (passable(here) || BLOCKS[here]?.replaceable) {
          this.world.setBlock(f.x, ly, f.z, f.id);
        } else {
          this.dropItem(f.id, f.x + 0.5, ly + 0.5, f.z + 0.5);
        }
        this.remove(f);
        continue;
      }
      f.y = next;
      f.mesh.position.set(f.x, f.y, f.z);
      const light = this.world.getLight(f.x, Math.floor(f.y + 0.5), f.z);
      (f.material.uniforms.u_lightOverride.value as THREE.Vector2).set((light >> 4) / 15, (light & 15) / 15);
    }
  }

  private remove(f: Falling) {
    this.group.remove(f.mesh);
    f.material.dispose();
    this.list.splice(this.list.indexOf(f), 1);
  }

  clear() {
    for (const f of [...this.list]) this.remove(f);
  }
}

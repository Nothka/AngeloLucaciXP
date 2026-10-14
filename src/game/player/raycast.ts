import * as THREE from "three";
import { B, SHAPE_CODE, isWater } from "../world/blocks";
import type { World } from "../world/world";

export interface RayHit {
  x: number;
  y: number;
  z: number;
  /** Face normal of the side that was hit; the placement cell is (x+nx, y+ny, z+nz). */
  nx: number;
  ny: number;
  nz: number;
  id: number;
  dist: number;
}

/** Local bounding box (in blocks) used for picking and the selection outline. */
export function blockBounds(id: number): [number, number, number, number, number, number] {
  const shape = SHAPE_CODE[id];
  if (shape === 2) return [0.12, 0, 0.12, 0.88, 0.82, 0.88];
  if (shape === 3) return [0.375, 0, 0.375, 0.625, 0.625, 0.625];
  return [0, 0, 0, 1, 1, 1];
}

/** Slab test against a sub-block box; returns entry distance and axis, or null. */
function rayBox(o: THREE.Vector3, d: THREE.Vector3, bx: number, by: number, bz: number, b: number[]) {
  let tmin = -Infinity;
  let tmax = Infinity;
  let axis = 0;
  const lo = [bx + b[0], by + b[1], bz + b[2]];
  const hi = [bx + b[3], by + b[4], bz + b[5]];
  const oa = [o.x, o.y, o.z];
  const da = [d.x, d.y, d.z];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(da[a]) < 1e-9) {
      if (oa[a] < lo[a] || oa[a] > hi[a]) return null;
      continue;
    }
    let t1 = (lo[a] - oa[a]) / da[a];
    let t2 = (hi[a] - oa[a]) / da[a];
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tmin) { tmin = t1; axis = a; }
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmax < 0 ? null : { t: Math.max(0, tmin), axis };
}

/** Entry distance of a ray into a world-space box, or null if it misses. */
export function rayAABB(o: THREE.Vector3, d: THREE.Vector3, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): number | null {
  const hit = rayBox(o, d, 0, 0, 0, [minX, minY, minZ, maxX, maxY, maxZ]);
  return hit ? hit.t : null;
}

/** Amanatides–Woo voxel traversal. Water and air are transparent to the ray. */
export function raycast(world: World, origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): RayHit | null {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / dir.x);
  const tDeltaY = Math.abs(1 / dir.y);
  const tDeltaZ = Math.abs(1 / dir.z);
  let tMaxX = dir.x > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
  let tMaxY = dir.y > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
  let tMaxZ = dir.z > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;
  let nx = 0, ny = 0, nz = 0;
  let t = 0;
  for (let i = 0; i < 64 && t <= maxDist; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== B.AIR && !isWater(id)) {
      const shape = SHAPE_CODE[id];
      if (shape === 1) return { x, y, z, nx, ny, nz, id, dist: t };
      const hit = rayBox(origin, dir, x, y, z, blockBounds(id));
      if (hit && hit.t <= maxDist) {
        const n = [0, 0, 0];
        const comp = hit.axis === 0 ? dir.x : hit.axis === 1 ? dir.y : dir.z;
        n[hit.axis] = comp > 0 ? -1 : 1;
        return { x, y, z, nx: n[0], ny: n[1], nz: n[2], id, dist: hit.t };
      }
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
    }
  }
  return null;
}

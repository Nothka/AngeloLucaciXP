import * as THREE from "three";
import { B, SHAPE_CODE, doorState, isWater, switchFace, isWallTorch, wallTorchFace } from "../world/blocks";
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
  const box = (a: number[], c: number[]): [number, number, number, number, number, number] => [a[0] / 16, a[1] / 16, a[2] / 16, c[0] / 16, c[1] / 16, c[2] / 16];
  switch (shape) {
    case 2: return [0.12, 0, 0.12, 0.88, 0.82, 0.88];
    case 3: {
      if (!isWallTorch(id)) return [0.375, 0, 0.375, 0.625, 0.625, 0.625];
      // The leaning wall torch: from the wall out to its tip.
      return ([[0, 0, 0, 0, 0, 0], [0.34, 0.18, 0, 0.66, 0.82, 0.4], [0.34, 0.18, 0.6, 0.66, 0.82, 1], [0, 0.18, 0.34, 0.4, 0.82, 0.66], [0.6, 0.18, 0.34, 1, 0.82, 0.66]] as const)[wallTorchFace(id)].slice() as [number, number, number, number, number, number];
    }
    case 5: return [0, 0, 0, 1, 1 / 16, 1];
    case 6: case 7: {
      const face = switchFace(id);
      const lever = shape === 6;
      const u = lever ? [4, 12] : [5, 11], v = lever ? [3, 13] : [6, 10], w = lever ? [0, 10] : [0, 2];
      const m = (f: number): [number[], number[]] => {
        switch (f) {
          case 1: return [[u[0], v[0], w[0]], [u[1], v[1], w[1]]];
          case 2: return [[16 - u[1], v[0], 16 - w[1]], [16 - u[0], v[1], 16 - w[0]]];
          case 3: return [[w[0], v[0], u[0]], [w[1], v[1], u[1]]];
          case 4: return [[16 - w[1], v[0], u[0]], [16 - w[0], v[1], u[1]]];
          default: return [[u[0], w[0], v[0]], [u[1], w[1], v[1]]];
        }
      };
      const [a, c] = m(face);
      return box(a, c);
    }
    case 8: return [1 / 16, 0, 1 / 16, 15 / 16, 2 / 16, 15 / 16];
    case 10: return [0, 0, 0, 1, 2 / 16, 1];
    case 9: {
      const st = doorState(id);
      const side = st.open ? (st.facing + 1) % 4 : st.facing;
      return [[0, 0, 0, 1, 1, 3 / 16], [13 / 16, 0, 0, 1, 1, 1], [0, 0, 13 / 16, 1, 1, 1], [0, 0, 0, 3 / 16, 1, 1]][side] as [number, number, number, number, number, number];
    }
  }
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
export function raycast(world: World, origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, hitWater = false): RayHit | null {
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
    if (hitWater && isWater(id)) return { x, y, z, nx, ny, nz, id, dist: t };
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

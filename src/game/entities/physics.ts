import { IS_SOLID } from "../world/blocks";

const EPS = 1e-4;

export interface Body {
  pos: { x: number; y: number; z: number };
  vel: { x: number; y: number; z: number };
  /** Half the footprint width (the box is square). */
  half: number;
  height: number;
  onGround: boolean;
  horizontalCollision: boolean;
}

export type SolidAt = (x: number, y: number, z: number) => boolean;

/**
 * Solid-block test shared by the player and mobs. Unloaded columns act solid
 * so nothing falls through terrain that is still streaming in; below the
 * bottom of the world there is nothing at all (the void).
 */
export function solidTester(world: { getBlock(x: number, y: number, z: number): number; isLoaded(x: number, z: number): boolean }): SolidAt {
  return (x, y, z) => {
    if (y < 0) return false;
    if (!world.isLoaded(x, z)) return true;
    return IS_SOLID[world.getBlock(x, y, z)] === 1;
  };
}

/**
 * One sub-step along an axis. The overlapped cells are fixed before the scan
 * and the box is clamped to the nearest blocking face, so a body standing
 * next to a run of solid cells is never walked through them one by one.
 */
function sweepStep(b: Body, axis: 0 | 1 | 2, delta: number, solidAt: SolidAt): boolean {
  const p = b.pos;
  if (axis === 0) p.x += delta;
  else if (axis === 1) p.y += delta;
  else p.z += delta;
  const h = b.half;
  const x0 = Math.floor(p.x - h + EPS), x1 = Math.floor(p.x + h - EPS);
  const y0 = Math.floor(p.y + EPS), y1 = Math.floor(p.y + b.height - EPS);
  const z0 = Math.floor(p.z - h + EPS), z1 = Math.floor(p.z + h - EPS);
  let hit = false;
  let limit = delta > 0 ? Infinity : -Infinity;
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (!solidAt(x, y, z)) continue;
        hit = true;
        const c = axis === 0 ? x : axis === 1 ? y : z;
        limit = delta > 0 ? Math.min(limit, c) : Math.max(limit, c);
      }
    }
  }
  if (!hit) return false;
  if (axis === 0) p.x = delta > 0 ? limit - h - EPS : limit + 1 + h + EPS;
  else if (axis === 1) p.y = delta > 0 ? limit - b.height - EPS : limit + 1 + EPS;
  else p.z = delta > 0 ? limit - h - EPS : limit + 1 + h + EPS;
  if (axis === 1) {
    if (delta < 0) b.onGround = true;
    b.vel.y = 0;
  } else {
    b.horizontalCollision = true;
    if (axis === 0) b.vel.x = 0;
    else b.vel.z = 0;
  }
  return true;
}

/** Axis-separated AABB move in sub-steps under half a block, so fast bodies never tunnel. */
export function sweepAxis(b: Body, axis: 0 | 1 | 2, delta: number, solidAt: SolidAt) {
  if (delta === 0) return;
  if (!Number.isFinite(delta)) return;
  // A body never needs to cover more than a few blocks in one physics step.
  const steps = Math.min(16, Math.ceil(Math.abs(delta) / 0.45));
  const part = delta / steps;
  for (let s = 0; s < steps; s++) {
    if (sweepStep(b, axis, part, solidAt)) return;
  }
}

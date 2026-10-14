/**
 * Game-style sound placement (not real acoustics): a sound is heard within a
 * fixed radius, its volume falls off linearly with distance, and it is split
 * between the left and right channels by where it sits relative to the way
 * the camera faces.
 */

/** Blocks beyond which a world sound is silent. */
export const HEARING_RANGE = 16;

export interface Listener {
  x: number;
  y: number;
  z: number;
  /** Camera yaw (radians); yaw 0 looks toward -Z. */
  yaw: number;
}

export interface Placement {
  /** 0..1 multiplier on the sound's own loudness. */
  volume: number;
  /** -1 = only the left channel, 1 = only the right. */
  pan: number;
  distance: number;
}

/** Where a sound at (x, y, z) lands for the listener, or null when out of earshot. */
export function spatialize(l: Listener, x: number, y: number, z: number, range = HEARING_RANGE): Placement | null {
  const dx = x - l.x, dy = y - l.y, dz = z - l.z;
  const distance = Math.hypot(dx, dy, dz);
  if (distance >= range) return null;
  const volume = 1 - distance / range;
  if (distance < 1e-3) return { volume, pan: 0, distance };
  // The camera's right-hand direction on the ground plane.
  const rx = Math.cos(l.yaw), rz = -Math.sin(l.yaw);
  // Dividing by the full 3D distance keeps sounds right above or below centred.
  const pan = Math.max(-1, Math.min(1, (dx * rx + dz * rz) / distance));
  return { volume, pan, distance };
}

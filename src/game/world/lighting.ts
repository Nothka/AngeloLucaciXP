import { CHUNK_AREA, CHUNK_HEIGHT, CHUNK_SIZE } from "../config";
import { EMIT, LIGHT_OPACITY } from "./blocks";

/**
 * Lighting runs over a 3x3-chunk "region" (48 x 128 x 48) centred on the chunk
 * being meshed. Light travels at most 15 blocks, so every source that can
 * reach the centre chunk lives inside the region and borders come out seamless.
 */
export const R = CHUNK_SIZE * 3;
export const RA = R * R;
export const RV = RA * CHUNK_HEIGHT;
export const rIndex = (x: number, y: number, z: number) => x + z * R + y * RA;

/** Copies the 9 neighbour chunks (index (dz+1)*3+(dx+1)) into one region array. */
export function buildRegion(chunks: Uint8Array[], out: Uint8Array) {
  for (let dz = 0; dz < 3; dz++) {
    for (let dx = 0; dx < 3; dx++) {
      const chunk = chunks[dz * 3 + dx];
      const ox = dx * CHUNK_SIZE;
      const oz = dz * CHUNK_SIZE;
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const src = z * CHUNK_SIZE + y * CHUNK_AREA;
          out.set(chunk.subarray(src, src + CHUNK_SIZE), rIndex(ox, y, oz + z));
        }
      }
    }
  }
}

const QUEUE_SIZE = 1 << 20;
const QUEUE_MASK = QUEUE_SIZE - 1;
const queue = new Int32Array(QUEUE_SIZE);

function propagate(rb: Uint8Array, light: Uint8Array, head: number, tail: number) {
  while (head !== tail) {
    const i = queue[head];
    head = (head + 1) & QUEUE_MASK;
    const l = light[i];
    if (l <= 1) continue;
    const x = i % R;
    const z = ((i / R) | 0) % R;
    const y = (i / RA) | 0;
    for (let n = 0; n < 6; n++) {
      let j: number;
      if (n === 0) { if (x === R - 1) continue; j = i + 1; }
      else if (n === 1) { if (x === 0) continue; j = i - 1; }
      else if (n === 2) { if (z === R - 1) continue; j = i + R; }
      else if (n === 3) { if (z === 0) continue; j = i - R; }
      else if (n === 4) { if (y === CHUNK_HEIGHT - 1) continue; j = i + RA; }
      else { if (y === 0) continue; j = i - RA; }
      const op = LIGHT_OPACITY[rb[j]];
      if (op >= 15) continue;
      const nl = l - (op > 1 ? op : 1);
      if (nl > light[j]) {
        light[j] = nl;
        queue[tail] = j;
        tail = (tail + 1) & QUEUE_MASK;
      }
    }
  }
}

/** Fills sky and block light (0..15) for the whole region. */
export function computeLight(rb: Uint8Array, sky: Uint8Array, blk: Uint8Array) {
  sky.fill(0);
  blk.fill(0);

  // Sunlight falls straight down until something absorbs it.
  let maxY = 0;
  for (let c = 0; c < RA; c++) {
    let l = 15;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      const i = c + y * RA;
      const op = LIGHT_OPACITY[rb[i]];
      if (op) {
        if (y > maxY) maxY = y;
        l = op >= 15 ? 0 : Math.max(0, l - op);
      }
      if (l === 0) break;
      sky[i] = l;
    }
  }

  // Seed the flood from lit cells that border a darker, light-passing cell.
  let tail = 0;
  const limit = Math.min(CHUNK_HEIGHT - 1, maxY + 1);
  for (let y = 0; y <= limit; y++) {
    for (let z = 0; z < R; z++) {
      for (let x = 0; x < R; x++) {
        const i = x + z * R + y * RA;
        const l = sky[i];
        if (l <= 1) continue;
        const t = l - 1;
        if (
          (x < R - 1 && sky[i + 1] < t && LIGHT_OPACITY[rb[i + 1]] < 15) ||
          (x > 0 && sky[i - 1] < t && LIGHT_OPACITY[rb[i - 1]] < 15) ||
          (z < R - 1 && sky[i + R] < t && LIGHT_OPACITY[rb[i + R]] < 15) ||
          (z > 0 && sky[i - R] < t && LIGHT_OPACITY[rb[i - R]] < 15) ||
          (y > 0 && sky[i - RA] < t && LIGHT_OPACITY[rb[i - RA]] < 15) ||
          (y < CHUNK_HEIGHT - 1 && sky[i + RA] < t && LIGHT_OPACITY[rb[i + RA]] < 15)
        ) {
          queue[tail] = i;
          tail = (tail + 1) & QUEUE_MASK;
        }
      }
    }
  }
  propagate(rb, sky, 0, tail);

  tail = 0;
  for (let i = 0; i < RV; i++) {
    const e = EMIT[rb[i]];
    if (e) {
      blk[i] = e;
      queue[tail] = i;
      tail = (tail + 1) & QUEUE_MASK;
    }
  }
  if (tail) propagate(rb, blk, 0, tail);
}

/** Extracts the centre chunk's light as packed (sky << 4 | block) bytes in chunk layout. */
export function extractCenterLight(sky: Uint8Array, blk: Uint8Array): Uint8Array {
  const out = new Uint8Array(CHUNK_AREA * CHUNK_HEIGHT);
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const r = rIndex(x + CHUNK_SIZE, y, z + CHUNK_SIZE);
        out[x + z * CHUNK_SIZE + y * CHUNK_AREA] = (sky[r] << 4) | blk[r];
      }
    }
  }
  return out;
}

import { CHUNK_HEIGHT, CHUNK_SIZE } from "../config";
import {
  B, FLUID_LEVEL, IS_OPAQUE, PASS_CODE, SHAPE_CODE, TILE, TILE_BOTTOM, TILE_FRONT, TILE_SIDE, TILE_TOP,
  doorState, switchFace, switchOn, waterHeight16, wirePower,
} from "../world/blocks";
import { wireShape } from "../world/redstone";
import { R, RA, rIndex } from "../world/lighting";

/**
 * Vertex layout (16 bytes), shared by chunk, item and view-model meshes:
 *   a_pos   u16 x4  position in 1/16 block units + face code (0..5 = +X,-X,+Y,-Y,+Z,-Z, 6 = plant)
 *   a_uv    u16 x2  texture coords in texels; the shader wraps them per tile
 *   a_light u8  x4  atlas layer, sky light, block light, ambient occlusion (0..3)
 */
export interface MeshData {
  pos: Uint16Array;
  uv: Uint16Array;
  light: Uint8Array;
  index: Uint16Array | Uint32Array;
}

export class MeshBuilder {
  pos = new Uint16Array(4 * 8192);
  uv = new Uint16Array(2 * 8192);
  light = new Uint8Array(4 * 8192);
  codes = new Uint8Array(2048);
  verts = 0;
  quads = 0;

  reset() {
    this.verts = 0;
    this.quads = 0;
  }

  private grow() {
    const grow = <T extends Uint16Array | Uint8Array>(arr: T, size: number): T => {
      const next = new (arr.constructor as { new (n: number): T })(size);
      next.set(arr);
      return next;
    };
    const cap = (this.pos.length / 4) * 2;
    this.pos = grow(this.pos, cap * 4);
    this.uv = grow(this.uv, cap * 2);
    this.light = grow(this.light, cap * 4);
  }

  vertex(x: number, y: number, z: number, face: number, u: number, v: number, layer: number, sky: number, blk: number, ao: number) {
    if (this.verts * 4 >= this.pos.length) this.grow();
    const i = this.verts++;
    const p = i * 4;
    this.pos[p] = x;
    this.pos[p + 1] = y;
    this.pos[p + 2] = z;
    this.pos[p + 3] = face;
    this.uv[i * 2] = u;
    this.uv[i * 2 + 1] = v;
    this.light[p] = layer;
    this.light[p + 1] = sky;
    this.light[p + 2] = blk;
    this.light[p + 3] = ao;
  }

  /** bit0: split along the 1-3 diagonal, bit1: reverse winding. */
  endQuad(code: number) {
    if (this.quads >= this.codes.length) {
      const next = new Uint8Array(this.codes.length * 2);
      next.set(this.codes);
      this.codes = next;
    }
    this.codes[this.quads++] = code;
  }

  finish(): MeshData {
    const vertexCount = this.verts;
    const index = vertexCount > 65535 ? new Uint32Array(this.quads * 6) : new Uint16Array(this.quads * 6);
    for (let q = 0; q < this.quads; q++) {
      const b = q * 4;
      const o = q * 6;
      const pattern = PATTERNS[this.codes[q]];
      for (let k = 0; k < 6; k++) index[o + k] = b + pattern[k];
    }
    return {
      pos: this.pos.slice(0, vertexCount * 4),
      uv: this.uv.slice(0, vertexCount * 2),
      light: this.light.slice(0, vertexCount * 4),
      index,
    };
  }
}

const PATTERNS = [
  [0, 1, 2, 0, 2, 3],
  [1, 2, 3, 1, 3, 0],
  [0, 2, 1, 0, 3, 2],
  [1, 3, 2, 1, 0, 3],
];

const DIMS = [CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE];
const STRIDE = [1, RA, R];
const OFF = CHUNK_SIZE;
const maskA = new Int32Array(CHUNK_HEIGHT * CHUNK_SIZE);
const maskB = new Int32Array(CHUNK_HEIGHT * CHUNK_SIZE);
const cAO = [0, 0, 0, 0];
const cSky = [0, 0, 0, 0];
const cBlk = [0, 0, 0, 0];
const SU = [-1, 1, 1, -1];
const SV = [-1, -1, 1, 1];

const solid = new MeshBuilder();
const water = new MeshBuilder();

function tileFor(id: number, face: number): number {
  if (face === 2) return TILE_TOP[id];
  if (face === 3) return TILE_BOTTOM[id];
  if (face === 0 || face === 4) return TILE_FRONT[id];
  return TILE_SIDE[id];
}

export interface ChunkMeshes {
  solid: MeshData;
  water: MeshData;
}

/**
 * Greedy-meshes the centre chunk of a lit region. Faces only merge when their
 * texture, per-corner light and ambient occlusion all match, so merging never
 * changes how the chunk looks.
 */
export function meshChunk(rb: Uint8Array, sky: Uint8Array, blk: Uint8Array): ChunkMeshes {
  solid.reset();
  water.reset();
  const p = [0, 0, 0];
  const corner = [0, 0, 0];

  const opaqueAt = (i: number, y: number) => (y < 0 ? 1 : y >= CHUNK_HEIGHT ? 0 : IS_OPAQUE[rb[i]]);
  const skyAt = (i: number, y: number) => (y < 0 ? 0 : y >= CHUNK_HEIGHT ? 15 : sky[i]);
  const blkAt = (i: number, y: number) => (y < 0 || y >= CHUNK_HEIGHT ? 0 : blk[i]);

  for (let a = 0; a < 3; a++) {
    const u = (a + 1) % 3;
    const v = (a + 2) % 3;
    const du = DIMS[u];
    const dv = DIMS[v];
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? 1 : -1;
      const face = a * 2 + side;
      const nStride = STRIDE[a] * sign;
      for (let s = 0; s < DIMS[a]; s++) {
        let any = false;
        for (let iv = 0; iv < dv; iv++) {
          for (let iu = 0; iu < du; iu++) {
            const m = iu + iv * du;
            maskA[m] = 0;
            p[a] = s;
            p[u] = iu;
            p[v] = iv;
            const y = p[1];
            const ri = rIndex(p[0] + OFF, y, p[2] + OFF);
            const id = rb[ri];
            const shape = SHAPE_CODE[id];
            if (shape !== 1 && shape !== 4) continue;
            const fy = a === 1 ? y + sign : y;
            const fri = ri + nStride;
            const nid = fy < 0 ? B.STONE : fy >= CHUNK_HEIGHT ? B.AIR : rb[fri];
            if (IS_OPAQUE[nid]) continue;
            if (shape === 4) {
              // Water: the surface height follows the level; side faces only
              // cover the part that rises above a lower neighbour, so cells of
              // different levels meet without gaps or overlapping faces.
              const above = y + 1 >= CHUNK_HEIGHT ? B.AIR : rb[ri + RA];
              const top = waterHeight16(id, above);
              let bottom = 0;
              if (a === 1) {
                if (sign > 0) {
                  if (FLUID_LEVEL[above]) continue;
                  // A full surface touching a block above would be coplanar with its underside.
                  if (top === 16 && above !== B.AIR) continue;
                } else if (FLUID_LEVEL[nid]) {
                  continue;
                }
              } else if (FLUID_LEVEL[nid]) {
                const nAbove = y + 1 >= CHUNK_HEIGHT ? B.AIR : rb[fri + RA];
                bottom = waterHeight16(nid, nAbove);
                if (bottom >= top) continue;
              }
              const faceTop = a === 1 && sign < 0 ? 16 : top;
              const partial = a !== 1 && (faceTop < 16 || bottom > 0);
              const sl = skyAt(fri, fy);
              const bl = blkAt(fri, fy);
              maskA[m] = (tileFor(id, face) + 1) | (1 << 17);
              // Partial side faces carry their row so they never merge vertically.
              maskB[m] = sl | (bl << 4) | (faceTop << 8) | (bottom << 13) | (partial ? (y + 1) << 18 : 0);
              any = true;
              continue;
            }
            if (nid === id && id === B.GLASS) continue;
            const isTransparent = PASS_CODE[id] !== 0;

            // Smooth light + AO from the cells in front of the face.
            if (fy >= CHUNK_HEIGHT) {
              for (let c = 0; c < 4; c++) { cAO[c] = 0; cSky[c] = 15; cBlk[c] = 0; }
            } else {
              for (let c = 0; c < 4; c++) {
                const su = SU[c];
                const sv = SV[c];
                const iU = fri + STRIDE[u] * su;
                const yU = fy + (u === 1 ? su : 0);
                const iV = fri + STRIDE[v] * sv;
                const yV = fy + (v === 1 ? sv : 0);
                const iC = iU + STRIDE[v] * sv;
                const yC = yU + (v === 1 ? sv : 0);
                const o1 = opaqueAt(iU, yU);
                const o2 = opaqueAt(iV, yV);
                const both = o1 && o2;
                const o3 = both ? 1 : opaqueAt(iC, yC);
                cAO[c] = both ? 3 : o1 + o2 + o3;
                let sumS = skyAt(fri, fy);
                let sumB = blkAt(fri, fy);
                let n = 1;
                if (!o1) { sumS += skyAt(iU, yU); sumB += blkAt(iU, yU); n++; }
                if (!o2) { sumS += skyAt(iV, yV); sumB += blkAt(iV, yV); n++; }
                if (!o3) { sumS += skyAt(iC, yC); sumB += blkAt(iC, yC); n++; }
                cSky[c] = Math.round(sumS / n);
                cBlk[c] = Math.round(sumB / n);
              }
            }
            maskA[m] =
              (tileFor(id, face) + 1) |
              ((cAO[0] | (cAO[1] << 2) | (cAO[2] << 4) | (cAO[3] << 6)) << 9) |
              ((isTransparent ? 4 : 0) << 17);
            maskB[m] =
              cSky[0] | (cSky[1] << 4) | (cSky[2] << 8) | (cSky[3] << 12) |
              ((cBlk[0] | (cBlk[1] << 4) | (cBlk[2] << 8) | (cBlk[3] << 12)) << 16);
            any = true;
          }
        }
        if (!any) continue;

        const plane = (s + (sign > 0 ? 1 : 0)) * 16;
        for (let iv = 0; iv < dv; iv++) {
          for (let iu = 0; iu < du; iu++) {
            const m = iu + iv * du;
            const ka = maskA[m];
            if (!ka) continue;
            const kb = maskB[m];
            let w = 1;
            while (iu + w < du && maskA[m + w] === ka && maskB[m + w] === kb) w++;
            let h = 1;
            outer: while (iv + h < dv) {
              const row = m + h * du;
              for (let k = 0; k < w; k++) {
                if (maskA[row + k] !== ka || maskB[row + k] !== kb) break outer;
              }
              h++;
            }
            for (let hv = 0; hv < h; hv++) {
              const row = m + hv * du;
              for (let k = 0; k < w; k++) maskA[row + k] = 0;
            }

            const layer = (ka & 511) - 1;
            const aoBits = (ka >> 9) & 255;
            const flags = ka >>> 17;
            const isWater = (flags & 1) !== 0;
            const builder = isWater ? water : solid;
            const wTop = isWater ? (kb >> 8) & 31 : 16;
            const wBottom = isWater ? (kb >> 13) & 31 : 0;
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0;
            let p0y = 0;
            for (let c = 0; c < 4; c++) {
              const cu = c === 1 || c === 2 ? iu + w : iu;
              const cv = c >= 2 ? iv + h : iv;
              corner[a] = plane;
              corner[u] = cu * 16;
              corner[v] = cv * 16;
              if (c === 0) p0y = corner[1];
              if (isWater) {
                if (a === 1 && sign > 0) corner[1] += wTop - 16;
                else if (a !== 1) corner[1] += corner[1] > p0y ? wTop - 16 : wBottom;
              }
              let tu: number, tv: number;
              if (a === 0) { tu = (cv - iv) * 16; tv = corner[1] - p0y; }
              else if (a === 2) { tu = (cu - iu) * 16; tv = corner[1] - p0y; }
              else { tu = (cv - iv) * 16; tv = (cu - iu) * 16; }
              const sl = isWater ? kb & 15 : (kb >> (c * 4)) & 15;
              const bl = isWater ? (kb >> 4) & 15 : (kb >>> (16 + c * 4)) & 15;
              const ao = (aoBits >> (c * 2)) & 3;
              builder.vertex(corner[0], corner[1], corner[2], face, tu, tv, layer, sl, bl, ao);
              const bright = Math.max(sl, bl) - ao * 3;
              if (c === 0) b0 = bright; else if (c === 1) b1 = bright; else if (c === 2) b2 = bright; else b3 = bright;
            }
            const flip = b0 + b2 < b1 + b3 ? 1 : 0;
            builder.endQuad(flip | (sign < 0 ? 2 : 0));
            iu += w - 1;
          }
        }
      }
    }
  }

  // Non-cube shapes: plants and torches.
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const ri = rIndex(x + OFF, y, z + OFF);
        const id = rb[ri];
        const shape = SHAPE_CODE[id];
        if (shape === 2) emitCross(solid, x, y, z, TILE_SIDE[id], sky[ri], blk[ri]);
        else if (shape === 3) emitTorch(solid, x, y, z, TILE_SIDE[id], sky[ri], id === B.REDSTONE_TORCH_OFF ? blk[ri] : 15);
        else if (shape >= 5) emitSpecial(solid, rb, x, y, z, id, sky[ri], blk[ri]);
      }
    }
  }

  return { solid: solid.finish(), water: water.finish() };
}

export function emitCross(b: MeshBuilder, x: number, y: number, z: number, layer: number, sl: number, bl: number) {
  const x0 = x * 16 + 2, x1 = x * 16 + 14;
  const z0 = z * 16 + 2, z1 = z * 16 + 14;
  const y0 = y * 16, y1 = y * 16 + 16;
  for (let diag = 0; diag < 2; diag++) {
    const za = diag === 0 ? z0 : z1;
    const zb = diag === 0 ? z1 : z0;
    for (let back = 0; back < 2; back++) {
      b.vertex(x0, y0, za, 6, 0, 0, layer, sl, bl, 0);
      b.vertex(x1, y0, zb, 6, 16, 0, layer, sl, bl, 0);
      b.vertex(x1, y1, zb, 6, 16, 16, layer, sl, bl, 0);
      b.vertex(x0, y1, za, 6, 0, 16, layer, sl, bl, 0);
      b.endQuad(back ? 2 : 0);
    }
  }
}

/**
 * Axis-aligned box in 1/16 units relative to block origin (bx,by,bz in blocks).
 * UVs come from the box's own sub-block coordinates, so a box carved from a
 * tile samples exactly the pixels it covers.
 */
export function emitBox(
  b: MeshBuilder, bx: number, by: number, bz: number,
  min: number[], max: number[], layer: number | number[], sl: number, bl: number,
  topUV?: [number, number, number, number],
) {
  const c = [0, 0, 0];
  for (let a = 0; a < 3; a++) {
    const u = (a + 1) % 3;
    const v = (a + 2) % 3;
    for (let side = 0; side < 2; side++) {
      const sign = side === 0 ? 1 : -1;
      const face = a * 2 + side;
      for (let k = 0; k < 4; k++) {
        c[a] = sign > 0 ? max[a] : min[a];
        c[u] = k === 1 || k === 2 ? max[u] : min[u];
        c[v] = k >= 2 ? max[v] : min[v];
        let tu: number, tv: number;
        if (a === 0) { tu = c[2]; tv = c[1]; }
        else if (a === 2) { tu = c[0]; tv = c[1]; }
        else { tu = c[0]; tv = c[2]; }
        if (a === 1 && topUV) {
          tu = c[0] === min[0] ? topUV[0] : topUV[2];
          tv = c[2] === min[2] ? topUV[1] : topUV[3];
        }
        const l = typeof layer === "number" ? layer : layer[face];
        b.vertex(bx * 16 + c[0], by * 16 + c[1], bz * 16 + c[2], face, tu, tv, l, sl, bl, 0);
      }
      b.endQuad(sign < 0 ? 2 : 0);
    }
  }
}

function emitTorch(b: MeshBuilder, x: number, y: number, z: number, layer: number, sl: number, bl = 15) {
  emitBox(b, x, y, z, [7, 0, 7], [9, 10, 9], layer, sl, bl, [7, 8, 9, 10]);
}

/**
 * Box in "attachment space" for things stuck on a floor or wall: u runs
 * along the surface, v up it (or along the floor), w away from it.
 */
function attachedBox(face: number, u0: number, u1: number, v0: number, v1: number, w0: number, w1: number): [number[], number[]] {
  let a: number[], c: number[];
  switch (face) {
    case 1: a = [u0, v0, w0]; c = [u1, v1, w1]; break; // wall at -Z
    case 2: a = [16 - u1, v0, 16 - w1]; c = [16 - u0, v1, 16 - w0]; break; // wall at +Z
    case 3: a = [w0, v0, u0]; c = [w1, v1, u1]; break; // wall at -X
    case 4: a = [16 - w1, v0, u0]; c = [16 - w0, v1, u1]; break; // wall at +X
    default: a = [u0, w0, v0]; c = [u1, w1, v1]; // floor
  }
  return [a, c];
}

/** Redstone dust, switches, plates and doors. */
function emitSpecial(b: MeshBuilder, rb: Uint8Array, x: number, y: number, z: number, id: number, sl: number, bl: number) {
  const shape = SHAPE_CODE[id];
  const at = (dx: number, dy: number, dz: number) => {
    const yy = y + dy;
    if (yy < 0) return B.STONE;
    if (yy >= CHUNK_HEIGHT) return B.AIR;
    return rb[rIndex(x + dx + OFF, yy, z + dz + OFF)];
  };
  if (shape === 5) {
    // Flat dust a pixel above the floor, shaped by what it connects to and brighter with power.
    const power = wirePower(id);
    const level = power === 0 ? 0 : power <= 5 ? 1 : power <= 10 ? 2 : 3;
    const getter = { getBlock: (wx: number, wy: number, wz: number) => at(wx - x, wy - y, wz - z) };
    const form = wireShape(getter, x, y, z);
    const layer = (form === "cross" ? TILE.wire_cross_0 : TILE.wire_line_0) + level;
    const px = x * 16, pz = z * 16, py = y * 16 + 1;
    const glow = Math.max(bl, Math.round(power / 3));
    // Lines run along X in the texture; turn the UVs for dust running along Z.
    const uv = form === "z" ? [[0, 0], [0, 16], [16, 16], [16, 0]] : [[0, 0], [16, 0], [16, 16], [0, 16]];
    b.vertex(px, py, pz, 2, uv[0][0], uv[0][1], layer, sl, glow, 0);
    b.vertex(px, py, pz + 16, 2, uv[1][0], uv[1][1], layer, sl, glow, 0);
    b.vertex(px + 16, py, pz + 16, 2, uv[2][0], uv[2][1], layer, sl, glow, 0);
    b.vertex(px + 16, py, pz, 2, uv[3][0], uv[3][1], layer, sl, glow, 0);
    b.endQuad(0);
    return;
  }
  if (shape === 6 || shape === 7) {
    const face = switchFace(id);
    const on = switchOn(id);
    if (shape === 6) {
      const [a, c] = attachedBox(face, 5, 11, 4, 12, 0, 3);
      emitBox(b, x, y, z, a, c, TILE.cobblestone, sl, bl);
      const [ha, hc] = on ? attachedBox(face, 7, 9, 9, 11, 3, 11) : attachedBox(face, 7, 9, 5, 7, 3, 11);
      emitBox(b, x, y, z, ha, hc, TILE.lever, sl, bl);
    } else {
      const [a, c] = attachedBox(face, 5, 11, 6, 10, 0, on ? 1 : 2);
      emitBox(b, x, y, z, a, c, TILE.stone, sl, bl);
    }
    return;
  }
  if (shape === 8) {
    emitBox(b, x, y, z, [1, 0, 1], [15, id === B.PRESSURE_PLATE_ON ? 1 : 2, 15], TILE.stone, sl, bl);
    return;
  }
  if (shape === 9) {
    const s = doorState(id);
    // The slab hugs side `facing` when closed and swings to the next side when open.
    const side = s.open ? (s.facing + 1) % 4 : s.facing;
    const boxes: [number[], number[]][] = [
      [[0, 0, 0], [16, 16, 3]],
      [[13, 0, 0], [16, 16, 16]],
      [[0, 0, 13], [16, 16, 16]],
      [[0, 0, 0], [3, 16, 16]],
    ];
    const [a, c] = boxes[side];
    emitBox(b, x, y, z, a, c, TILE_SIDE[id], sl, bl);
  }
}

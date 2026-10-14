import { CHUNK_HEIGHT, CHUNK_SIZE, CHUNK_VOLUME, SEA_LEVEL, blockIndex } from "../config";
import { SimplexNoise, hash2, hash3, lerp, smoothstep } from "../noise";
import { B } from "./blocks";

export enum Biome {
  OCEAN,
  BEACH,
  PLAINS,
  FOREST,
  DESERT,
  MOUNTAINS,
}

export const BIOME_NAMES = ["Ocean", "Beach", "Plains", "Forest", "Desert", "Mountains"];

export interface Column {
  height: number;
  biome: Biome;
  mountain: number;
}

const MAX_SURFACE = CHUNK_HEIGHT - 16;

/**
 * Deterministic terrain: every column and every carved voxel is a pure
 * function of (seed, x, y, z), so neighbouring chunks agree on trees and caves
 * that cross their borders without any shared state.
 */
export class TerrainGenerator {
  readonly seed: number;
  private continent: SimplexNoise;
  private erosion: SimplexNoise;
  private ridge: SimplexNoise;
  private detail: SimplexNoise;
  private temperature: SimplexNoise;
  private humidity: SimplexNoise;
  private caveA: SimplexNoise;
  private caveB: SimplexNoise;
  private cavern: SimplexNoise;
  private ore: SimplexNoise;
  private patch: SimplexNoise;

  constructor(seed: number) {
    this.seed = seed;
    this.continent = new SimplexNoise(seed ^ 0x1a2b3c);
    this.erosion = new SimplexNoise(seed ^ 0x2b3c4d);
    this.ridge = new SimplexNoise(seed ^ 0x3c4d5e);
    this.detail = new SimplexNoise(seed ^ 0x4d5e6f);
    this.temperature = new SimplexNoise(seed ^ 0x5e6f70);
    this.humidity = new SimplexNoise(seed ^ 0x6f7081);
    this.caveA = new SimplexNoise(seed ^ 0x708192);
    this.caveB = new SimplexNoise(seed ^ 0x8192a3);
    this.cavern = new SimplexNoise(seed ^ 0x92a3b4);
    this.ore = new SimplexNoise(seed ^ 0xa3b4c5);
    this.patch = new SimplexNoise(seed ^ 0xb4c5d6);
  }

  column(wx: number, wz: number, out: Column = { height: 0, biome: Biome.PLAINS, mountain: 0 }): Column {
    const c = this.continent.fbm2(wx / 900, wz / 900, 4);
    const e = this.erosion.fbm2(wx / 420, wz / 420, 3);
    const t = this.temperature.fbm2(wx / 650, wz / 650, 2);
    const hum = this.humidity.fbm2(wx / 500, wz / 500, 2);
    const detail = this.detail.fbm2(wx / 110, wz / 110, 4);

    const land = smoothstep(-0.32, -0.1, c);
    const base = lerp(SEA_LEVEL - 16 + c * 10, SEA_LEVEL + 3 + c * 6, land);
    const mountain = smoothstep(0.12, 0.48, e) * land;
    const r = 1 - Math.abs(this.ridge.fbm2(wx / 230, wz / 230, 4));
    const ridged = r * r;
    const desert = smoothstep(0.22, 0.38, t) * (1 - mountain);

    let h = base + detail * lerp(6, 2.5, desert) + mountain * (ridged * 50 + detail * 10 + 4);
    h = Math.max(3, Math.min(MAX_SURFACE, Math.floor(h)));

    let biome: Biome;
    if (mountain > 0.42 && h > SEA_LEVEL + 6) biome = Biome.MOUNTAINS;
    else if (h < SEA_LEVEL - 1) biome = Biome.OCEAN;
    else if (desert > 0.5) biome = Biome.DESERT;
    else if (h <= SEA_LEVEL + 1) biome = Biome.BEACH;
    else if (hum > 0.04) biome = Biome.FOREST;
    else biome = Biome.PLAINS;

    out.height = h;
    out.biome = biome;
    out.mountain = mountain;
    return out;
  }

  /** True where a cave tunnel or cavern removes the voxel. */
  carved(wx: number, y: number, wz: number, height: number): boolean {
    if (y < 5 || y > height) return false;
    // Keep shores and sea floors sealed: there is no fluid simulation to fill openings.
    if (height < SEA_LEVEL + 4 && y > height - 6) return false;
    const a = this.caveA.noise3(wx / 48, y / 26, wz / 48);
    const b = this.caveB.noise3(wx / 48, y / 26, wz / 48);
    if (a * a + b * b < 0.0075) return true;
    if (y < 34) {
      const cav = this.cavern.noise3(wx / 72, y / 30, wz / 72);
      if (cav > 0.62 - (34 - y) * 0.004) return true;
    }
    return false;
  }

  private treeHeight(wx: number, wz: number, col: Column): number {
    let chance = 0;
    if (col.biome === Biome.FOREST) chance = 0.028;
    else if (col.biome === Biome.PLAINS) chance = 0.004;
    else if (col.biome === Biome.MOUNTAINS && col.height < SEA_LEVEL + 30) chance = 0.012;
    if (chance === 0 || col.height < SEA_LEVEL) return 0;
    if (hash2(this.seed ^ 0x5eed, wx, wz) >= chance) return 0;
    if (this.surfaceBlock(col, wx, wz) !== B.GRASS) return 0;
    if (this.carved(wx, col.height, wz, col.height) || this.carved(wx, col.height - 1, wz, col.height)) return 0;
    return 4 + Math.floor(hash2(this.seed ^ 0x7777, wx, wz) * 3);
  }

  private surfaceBlock(col: Column, wx: number, wz: number): number {
    const h = col.height;
    switch (col.biome) {
      case Biome.OCEAN:
        return this.patch.noise2(wx / 24, wz / 24) > 0.1 || h > SEA_LEVEL - 6 ? B.SAND : B.DIRT;
      case Biome.BEACH:
      case Biome.DESERT:
        return B.SAND;
      case Biome.MOUNTAINS: {
        const jitter = this.patch.noise2(wx / 9, wz / 9) * 4;
        if (h > 100 + jitter) return B.SNOW;
        if (h > 95 + jitter) return B.SNOWY_GRASS;
        if (h > 84 + jitter) return B.STONE;
        return B.GRASS;
      }
      default:
        return h < SEA_LEVEL ? B.DIRT : B.GRASS;
    }
  }

  generate(cx: number, cz: number): Uint8Array {
    const blocks = new Uint8Array(CHUNK_VOLUME);
    const seed = this.seed;
    const col: Column = { height: 0, biome: Biome.PLAINS, mountain: 0 };
    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = ox + x;
        const wz = oz + z;
        this.column(wx, wz, col);
        const h = col.height;
        const top = this.surfaceBlock(col, wx, wz);
        const sandy = top === B.SAND;
        const fillerDepth = col.biome === Biome.DESERT ? 4 : 3;
        const filler = sandy ? B.SAND : top === B.STONE || top === B.SNOW ? B.STONE : B.DIRT;

        const maxY = Math.max(h, SEA_LEVEL);
        for (let y = 0; y <= maxY; y++) {
          const i = blockIndex(x, y, z);
          if (y === 0 || (y <= 3 && hash3(seed, wx, y, wz) < 0.62 - y * 0.18)) {
            blocks[i] = B.BEDROCK;
            continue;
          }
          if (y <= h) {
            if (this.carved(wx, y, wz, h)) continue;
            const depth = h - y;
            if (depth === 0) blocks[i] = top;
            else if (depth <= fillerDepth) blocks[i] = filler;
            else if (sandy && col.biome === Biome.DESERT && depth <= fillerDepth + 3) blocks[i] = B.SANDSTONE;
            else if (y < h - 3 && this.ore.noise3(wx / 4.5, y / 4.5, wz / 4.5) > 0.7) blocks[i] = B.COAL_ORE;
            else blocks[i] = B.STONE;
          } else if (y <= SEA_LEVEL) {
            blocks[i] = B.WATER;
          }
        }

        // Ground cover on untouched grass.
        if (top === B.GRASS && h >= SEA_LEVEL && h + 1 < CHUNK_HEIGHT && blocks[blockIndex(x, h, z)] === B.GRASS) {
          const r = hash2(seed ^ 0xabc, wx, wz);
          const grassChance = col.biome === Biome.PLAINS ? 0.12 : col.biome === Biome.FOREST ? 0.06 : 0.04;
          if (r < 0.012) {
            blocks[blockIndex(x, h + 1, z)] = hash2(seed ^ 0xf10, wx, wz) < 0.5 ? B.FLOWER_YELLOW : B.FLOWER_RED;
          } else if (r < 0.012 + grassChance) {
            blocks[blockIndex(x, h + 1, z)] = B.TALL_GRASS;
          }
        }
      }
    }

    // Trees rooted up to 2 blocks outside the chunk can still drop leaves into it.
    for (let tz = -2; tz < CHUNK_SIZE + 2; tz++) {
      for (let tx = -2; tx < CHUNK_SIZE + 2; tx++) {
        const wx = ox + tx;
        const wz = oz + tz;
        this.column(wx, wz, col);
        const trunk = this.treeHeight(wx, wz, col);
        if (trunk > 0) this.placeTree(blocks, tx, col.height + 1, tz, trunk, wx, wz);
      }
    }
    return blocks;
  }

  private placeTree(blocks: Uint8Array, x: number, y: number, z: number, trunk: number, wx: number, wz: number) {
    const topY = y + trunk - 1;
    const setLeaf = (lx: number, ly: number, lz: number) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || ly >= CHUNK_HEIGHT) return;
      const i = blockIndex(lx, ly, lz);
      const cur = blocks[i];
      if (cur === B.AIR || cur === B.TALL_GRASS || cur === B.FLOWER_RED || cur === B.FLOWER_YELLOW) blocks[i] = B.LEAVES;
    };
    for (let ly = topY - 2; ly <= topY + 1; ly++) {
      const radius = ly >= topY ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const corner = Math.abs(dx) === radius && Math.abs(dz) === radius;
          if (corner) {
            if (ly === topY + 1) continue;
            if (hash3(this.seed ^ 0xbeef, wx + dx, ly, wz + dz) < 0.5) continue;
          }
          if (ly === topY + 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          setLeaf(x + dx, ly, z + dz);
        }
      }
    }
    if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) {
      for (let ly = y; ly <= topY && ly < CHUNK_HEIGHT; ly++) blocks[blockIndex(x, ly, z)] = B.LOG;
      if (y - 1 >= 0) blocks[blockIndex(x, y - 1, z)] = B.DIRT;
    }
  }

  /** First dry land near the origin, searched in a widening square spiral. */
  findSpawn(): { x: number; y: number; z: number } {
    const col: Column = { height: 0, biome: Biome.PLAINS, mountain: 0 };
    for (let radius = 0; radius < 2048; radius += 8) {
      for (let dz = -radius; dz <= radius; dz += 8) {
        for (let dx = -radius; dx <= radius; dx += 8) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          this.column(dx, dz, col);
          if (col.height > SEA_LEVEL + 1 && col.biome !== Biome.MOUNTAINS && col.biome !== Biome.OCEAN) {
            if (this.carved(dx, col.height, dz, col.height)) continue;
            return { x: dx + 0.5, y: col.height + 1, z: dz + 0.5 };
          }
        }
      }
    }
    return { x: 0.5, y: CHUNK_HEIGHT - 20, z: 0.5 };
  }
}

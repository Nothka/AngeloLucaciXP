import * as THREE from "three";
import { mulberry32 } from "../noise";
import { TILE_NAMES, type TileName } from "../world/blocks";

/**
 * Every texture in the game is painted here, pixel by pixel, from small
 * hand-picked palettes and a seeded RNG — no image files are shipped.
 */

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

export class Pixels {
  readonly data: Uint8ClampedArray;
  constructor(readonly w = 16, readonly h = 16) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: RGB | string, a = 255) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const rgb = typeof c === "string" ? hex(c) : c;
    const i = (y * this.w + x) * 4;
    this.data[i] = rgb[0];
    this.data[i + 1] = rgb[1];
    this.data[i + 2] = rgb[2];
    this.data[i + 3] = a;
  }
  get(x: number, y: number): RGB {
    const i = (((y + this.h) % this.h) * this.w + ((x + this.w) % this.w)) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }
  alpha(x: number, y: number) {
    return this.data[(y * this.w + x) * 4 + 3];
  }
  fill(fn: (x: number, y: number) => RGB | string | null) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = fn(x, y);
        if (c) this.set(x, y, c);
      }
    }
  }
  shade(x: number, y: number, k: number) {
    const [r, g, b] = this.get(x, y);
    this.set(x, y, [r * k, g * k, b * k], this.alpha(x, y));
  }
  toCanvas(scale = 1): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = this.w * scale;
    c.height = this.h * scale;
    const ctx = c.getContext("2d")!;
    const img = new ImageData(new Uint8ClampedArray(this.data), this.w, this.h);
    if (scale === 1) {
      ctx.putImageData(img, 0, 0);
    } else {
      const tmp = document.createElement("canvas");
      tmp.width = this.w;
      tmp.height = this.h;
      tmp.getContext("2d")!.putImageData(img, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, c.width, c.height);
    }
    return c;
  }
}

const pick = <T,>(rand: () => number, arr: T[]) => arr[Math.floor(rand() * arr.length)];

/** Weighted palette noise: lower indices are more common. */
const noisePalette = (rand: () => number, palette: string[]) => () => {
  const r = rand();
  return palette[Math.min(palette.length - 1, Math.floor(r * r * palette.length * 1.4))];
};

function paintDirt(p: Pixels, rand: () => number) {
  const n = noisePalette(rand, ["#8a6142", "#7c5539", "#966c4a", "#6b4a31", "#a27a57", "#5a3d29"]);
  p.fill(() => n());
  for (let k = 0; k < 6; k++) {
    const x = Math.floor(rand() * 16);
    const y = Math.floor(rand() * 16);
    p.set(x, y, pick(rand, ["#b48b66", "#5e432f", "#a8a29a"]));
  }
}

const GRASS = ["#62a83a", "#57992f", "#6fb744", "#4f8c2a", "#7cc24e", "#46802a"];

function paintGrassTop(p: Pixels, rand: () => number) {
  const n = noisePalette(rand, GRASS);
  p.fill(() => n());
  for (let k = 0; k < 10; k++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), "#8ad05a");
}

function paintGrassSide(p: Pixels, rand: () => number, top = GRASS, snowy = false) {
  paintDirt(p, rand);
  const n = noisePalette(rand, top);
  for (let x = 0; x < 16; x++) {
    const depth = 3 + Math.floor(rand() * 2.2) + (rand() < 0.25 ? 2 : 0);
    for (let y = 0; y < depth; y++) p.set(x, y, n());
    if (!snowy && rand() < 0.5) p.shade(x, depth, 0.85);
  }
}

function paintStone(p: Pixels, rand: () => number) {
  const n = noisePalette(rand, ["#7f7f7f", "#757575", "#8a8a8a", "#6c6c6c", "#949494"]);
  p.fill(() => n());
  for (let k = 0; k < 7; k++) {
    const x = Math.floor(rand() * 16);
    const y = Math.floor(rand() * 16);
    const len = 2 + Math.floor(rand() * 4);
    for (let i = 0; i < len; i++) p.set((x + i) % 16, y, i % 2 ? "#666666" : "#6e6e6e");
    p.set(x, (y + 1) % 16, "#9c9c9c");
  }
}

/** Irregular rounded stones: a wrapped Voronoi pattern with dark mortar. */
function paintCells(p: Pixels, rand: () => number, count: number, colors: string[], mortar: string, highlight: string) {
  const pts: { x: number; y: number; c: RGB }[] = [];
  for (let i = 0; i < count; i++) pts.push({ x: rand() * 16, y: rand() * 16, c: hex(pick(rand, colors)) });
  const owner = new Int16Array(256);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      let best = 0;
      let bd = 1e9;
      pts.forEach((pt, i) => {
        let dx = Math.abs(pt.x - x);
        let dy = Math.abs(pt.y - y);
        dx = Math.min(dx, 16 - dx);
        dy = Math.min(dy, 16 - dy);
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = i; }
      });
      owner[y * 16 + x] = best;
    }
  }
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const o = owner[y * 16 + x];
      const right = owner[y * 16 + ((x + 1) % 16)];
      const down = owner[((y + 1) % 16) * 16 + x];
      const up = owner[((y + 15) % 16) * 16 + x];
      const left = owner[y * 16 + ((x + 15) % 16)];
      const base = pts[o].c;
      const v = 0.92 + rand() * 0.14;
      if (o !== right || o !== down) p.set(x, y, mortar);
      else if (o !== up || o !== left) p.set(x, y, highlight);
      else p.set(x, y, [base[0] * v, base[1] * v, base[2] * v]);
    }
  }
}

function paintSand(p: Pixels, rand: () => number, palette = ["#dccf9c", "#d6c78f", "#e3d8aa", "#cdbd83", "#e8dfb8"]) {
  const n = noisePalette(rand, palette);
  p.fill(() => n());
}

function paintSandstoneSide(p: Pixels, rand: () => number) {
  paintSand(p, rand, ["#d9c88f", "#d2c085", "#dfd09c"]);
  for (let x = 0; x < 16; x++) {
    p.set(x, 0, "#e7dbaf");
    p.set(x, 1, "#e2d4a2");
    p.set(x, 3, rand() < 0.7 ? "#c6b277" : "#cdb97e");
    p.set(x, 11, rand() < 0.8 ? "#c2ad72" : "#cbb77c");
    p.set(x, 14, "#bea86d");
    p.set(x, 15, "#b39d62");
  }
}

function paintLogSide(p: Pixels, rand: () => number) {
  const cols = ["#6d5132", "#5d4429", "#7b5d3a", "#4f3a22"];
  const colorOf: string[] = [];
  for (let x = 0; x < 16; x++) colorOf.push(pick(rand, cols));
  p.fill((x) => colorOf[x]);
  for (let x = 0; x < 16; x++) {
    for (let y = 0; y < 16; y++) {
      const r = rand();
      if (r < 0.12) p.set(x, y, "#46331d");
      else if (r < 0.2) p.set(x, y, "#866642");
    }
  }
  for (let k = 0; k < 4; k++) {
    const x = Math.floor(rand() * 16);
    const y = Math.floor(rand() * 13);
    p.set(x, y, "#3c2b18");
    p.set(x, y + 1, "#3c2b18");
    p.set(x, y + 2, "#46331d");
  }
}

function paintLogTop(p: Pixels, rand: () => number) {
  p.fill((x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return rand() < 0.5 ? "#5d4429" : "#6d5132";
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    const ring = Math.floor(d + rand() * 0.6) % 2;
    return ring ? "#a8854f" : "#b9975f";
  });
  p.set(7, 7, "#8e6d3e");
  p.set(8, 8, "#8e6d3e");
}

function paintLeaves(p: Pixels, rand: () => number) {
  const n = noisePalette(rand, ["#3e7b26", "#468a2c", "#356a20", "#52983a", "#2d5c1b"]);
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (rand() < 0.2) continue;
      p.set(x, y, n());
    }
  }
  for (let k = 0; k < 10; k++) p.set(Math.floor(rand() * 16), Math.floor(rand() * 16), "#68b046");
}

function paintPlanks(p: Pixels, rand: () => number, palette = ["#a8844f", "#9f7c48", "#b08c56", "#98743f"]) {
  const n = noisePalette(rand, palette);
  p.fill(() => n());
  for (let board = 0; board < 4; board++) {
    const y0 = board * 4;
    const seam = (board * 7 + 3 + Math.floor(rand() * 4)) % 16;
    for (let x = 0; x < 16; x++) {
      p.set(x, y0 + 3, "#6b512e");
      if (rand() < 0.35) p.set(x, y0 + 1, "#8f6e3e");
    }
    for (let y = y0; y < y0 + 3; y++) p.set(seam, y, "#6b512e");
    p.set((seam + 5) % 16, y0 + 1, "#7a5c34");
  }
}

function paintGlass(p: Pixels) {
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const edge = x === 0 || y === 0 || x === 15 || y === 15;
      if (edge) p.set(x, y, x === 0 || y === 0 ? "#e8f4f8" : "#a9c9d4");
    }
  }
  const streak = [[3, 3], [4, 4], [5, 5], [3, 5], [4, 6], [10, 9], [11, 10], [12, 11], [10, 11]];
  for (const [x, y] of streak) p.set(x, y, "#ffffff", 200);
}

function paintWater(p: Pixels, rand: () => number) {
  const n = noisePalette(rand, ["#2f62d2", "#3468da", "#2955c4", "#3a72e2"]);
  p.fill(() => n());
  for (let k = 0; k < 6; k++) {
    const y = Math.floor(rand() * 16);
    const x = Math.floor(rand() * 16);
    for (let i = 0; i < 4; i++) p.set((x + i) % 16, y, "#5a8ef0");
  }
}

function paintOre(p: Pixels, rand: () => number, colors: string[]) {
  paintStone(p, rand);
  for (let k = 0; k < 5; k++) {
    const cx = 2 + Math.floor(rand() * 12);
    const cy = 2 + Math.floor(rand() * 12);
    const size = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < size; i++) {
      const x = cx + Math.floor(rand() * 3) - 1;
      const y = cy + Math.floor(rand() * 3) - 1;
      p.set(x, y, colors[0]);
      p.set(x + 1, y, colors[1]);
      p.set(x, y + 1, colors[2]);
    }
  }
}

function paintTorch(p: Pixels) {
  // Rows are listed from the bottom: the mesher samples x 7..8, rows 0..9.
  const at = (x: number, row: number, c: string) => p.set(x, 15 - row, c);
  for (let row = 0; row < 8; row++) {
    at(7, row, row % 3 === 0 ? "#5a3e22" : "#7a5531");
    at(8, row, row % 3 === 1 ? "#5a3e22" : "#8d6639");
  }
  at(7, 8, "#ffb32e");
  at(8, 8, "#ff8f1f");
  at(7, 9, "#fff2a8");
  at(8, 9, "#ffd34a");
}

function paintCraftingTop(p: Pixels, rand: () => number) {
  paintPlanks(p, rand, ["#b6905a", "#ad8852", "#bf9963"]);
  for (let i = 0; i < 16; i++) {
    p.set(i, 0, "#5b4326");
    p.set(i, 15, "#5b4326");
    p.set(0, i, "#5b4326");
    p.set(15, i, "#5b4326");
  }
  for (let i = 2; i < 14; i++) {
    p.set(i, 5, "#6f5431");
    p.set(i, 10, "#6f5431");
    p.set(5, i, "#6f5431");
    p.set(10, i, "#6f5431");
  }
}

function paintCraftingSide(p: Pixels, rand: () => number, front: boolean) {
  paintPlanks(p, rand);
  for (let x = 0; x < 16; x++) {
    p.set(x, 0, "#5b4326");
    p.set(x, 1, "#7d5e36");
    p.set(x, 2, "#5b4326");
  }
  if (front) {
    // Hammer
    for (let y = 5; y < 13; y++) p.set(4, y, "#6b4a2a");
    for (let x = 2; x < 7; x++) { p.set(x, 4, "#8d8d8d"); p.set(x, 5, "#6e6e6e"); }
    // Saw
    for (let x = 8; x < 14; x++) { p.set(x, 7, "#b8b8b8"); p.set(x, 8, x % 2 ? "#8a8a8a" : "#b8b8b8"); }
    p.set(14, 7, "#6b4a2a");
    p.set(14, 8, "#6b4a2a");
    p.set(15, 7, "#6b4a2a");
  } else {
    for (let y = 5; y < 12; y++) { p.set(7, y, "#c9c9c9"); p.set(8, y, "#9a9a9a"); }
    p.set(7, 12, "#6b4a2a"); p.set(8, 12, "#6b4a2a"); p.set(7, 13, "#6b4a2a"); p.set(8, 13, "#6b4a2a");
    p.set(6, 5, "#c9c9c9"); p.set(9, 5, "#9a9a9a");
  }
}

function paintBedrock(p: Pixels, rand: () => number) {
  const n = noisePalette(rand, ["#3a3a3a", "#575757", "#262626", "#6f6f6f", "#1a1a1a"]);
  p.fill(() => n());
}

function paintTallGrass(p: Pixels, rand: () => number) {
  for (let b = 0; b < 7; b++) {
    let x = 1 + Math.floor(rand() * 14);
    const top = 3 + Math.floor(rand() * 8);
    for (let y = 15; y >= top; y--) {
      p.set(x, y, y < top + 2 ? "#7ec552" : pick(rand, ["#5aa036", "#4c8e2e", "#66ae3f"]));
      if (rand() < 0.18) x += rand() < 0.5 ? -1 : 1;
    }
  }
}

function paintFlower(p: Pixels, rand: () => number, petals: string[], center: string) {
  for (let y = 8; y < 16; y++) p.set(7 + (y > 12 ? 1 : 0), y, "#4c8e2e");
  p.set(6, 11, "#5aa036");
  p.set(5, 10, "#5aa036");
  p.set(9, 12, "#5aa036");
  const cx = 7;
  const cy = 5;
  for (const [dx, dy] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) {
    p.set(cx + dx, cy + dy, pick(rand, petals));
  }
  p.set(cx, cy, center);
}

function paintSnow(p: Pixels, rand: () => number) {
  const n = noisePalette(rand, ["#f2f7f9", "#e6eff3", "#fbfdfe", "#dbe6ec"]);
  p.fill(() => n());
}

const PAINTERS: Record<TileName, (p: Pixels, rand: () => number) => void> = {
  grass_top: paintGrassTop,
  grass_side: (p, r) => paintGrassSide(p, r),
  dirt: paintDirt,
  stone: paintStone,
  cobblestone: (p, r) => paintCells(p, r, 9, ["#8a8a8a", "#7a7a7a", "#969696", "#6e6e6e"], "#4b4b4b", "#a6a6a6"),
  sand: (p, r) => paintSand(p, r),
  sandstone_top: (p, r) => paintSand(p, r, ["#e1d3a1", "#dccd97", "#e6daad"]),
  sandstone_side: paintSandstoneSide,
  sandstone_bottom: (p, r) => {
    paintSand(p, r, ["#d4c287", "#cdb97e", "#d9c88f"]);
    for (let k = 0; k < 6; k++) p.set(Math.floor(r() * 16), Math.floor(r() * 16), "#b9a46a");
  },
  log_side: paintLogSide,
  log_top: paintLogTop,
  leaves: paintLeaves,
  planks: (p, r) => paintPlanks(p, r),
  glass: (p) => paintGlass(p),
  water: paintWater,
  coal_ore: (p, r) => paintOre(p, r, ["#1d1d1d", "#2f2f2f", "#404040"]),
  torch: (p) => paintTorch(p),
  crafting_table_top: paintCraftingTop,
  crafting_table_side: (p, r) => paintCraftingSide(p, r, false),
  crafting_table_front: (p, r) => paintCraftingSide(p, r, true),
  bedrock: paintBedrock,
  tall_grass: paintTallGrass,
  flower_yellow: (p, r) => paintFlower(p, r, ["#f5d31f", "#ffe04a", "#e8bf14"], "#d9881a"),
  flower_red: (p, r) => paintFlower(p, r, ["#d6232a", "#e8363c", "#b81a20"], "#2b1a10"),
  snow: paintSnow,
  grass_side_snow: (p, r) => paintGrassSide(p, r, ["#f2f7f9", "#e6eff3", "#fbfdfe"], true),
};

export interface TextureSet {
  tiles: Pixels[];
  atlasCanvas: HTMLCanvasElement;
  arrayTexture: THREE.DataArrayTexture;
}

let cached: TextureSet | null = null;

export function getTextures(): TextureSet {
  if (cached) return cached;
  const tiles = TILE_NAMES.map((name, i) => {
    const p = new Pixels();
    PAINTERS[name](p, mulberry32(0x5eed + i * 7919));
    return p;
  });

  // Atlas canvas: 16 tiles per row, the canonical sheet (also used for UI icons).
  const perRow = 16;
  const atlasCanvas = document.createElement("canvas");
  atlasCanvas.width = perRow * 16;
  atlasCanvas.height = Math.ceil(tiles.length / perRow) * 16;
  const ctx = atlasCanvas.getContext("2d")!;
  tiles.forEach((t, i) => ctx.putImageData(new ImageData(new Uint8ClampedArray(t.data), 16, 16), (i % perRow) * 16, Math.floor(i / perRow) * 16));

  // The same tiles as a texture array so greedy quads can repeat a tile with mipmaps intact.
  const data = new Uint8Array(16 * 16 * 4 * tiles.length);
  tiles.forEach((t, layer) => {
    for (let y = 0; y < 16; y++) {
      const srcRow = (15 - y) * 64;
      data.set(t.data.subarray(srcRow, srcRow + 64), layer * 1024 + y * 64);
    }
  });
  const arrayTexture = new THREE.DataArrayTexture(data, 16, 16, tiles.length);
  arrayTexture.format = THREE.RGBAFormat;
  arrayTexture.magFilter = THREE.NearestFilter;
  arrayTexture.minFilter = THREE.NearestMipmapLinearFilter;
  arrayTexture.wrapS = THREE.RepeatWrapping;
  arrayTexture.wrapT = THREE.RepeatWrapping;
  arrayTexture.generateMipmaps = true;
  arrayTexture.needsUpdate = true;

  cached = { tiles, atlasCanvas, arrayTexture };
  return cached;
}

/** Ten crack overlays (mid-grey = no change under multiply-2x blending). */
export function createCrackTextures(): THREE.Texture[] {
  const rand = mulberry32(0xc0ffee);
  const segments: [number, number][] = [];
  const walkers = [[7.5, 7.5], [7.5, 7.5], [7.5, 7.5], [7.5, 7.5]];
  const dirs = [[1, 0.3], [-1, -0.2], [0.2, 1], [-0.3, -1]];
  for (let step = 0; step < 40; step++) {
    const w = step % walkers.length;
    const d = dirs[w];
    walkers[w][0] += d[0] + (rand() - 0.5) * 1.2;
    walkers[w][1] += d[1] + (rand() - 0.5) * 1.2;
    if (rand() < 0.15) {
      dirs[w] = [dirs[w][1] * (rand() < 0.5 ? 1 : -1), dirs[w][0]];
    }
    segments.push([Math.round(walkers[w][0]), Math.round(walkers[w][1])]);
    if (rand() < 0.4) segments.push([Math.round(walkers[w][0] + (rand() - 0.5) * 3), Math.round(walkers[w][1] + (rand() - 0.5) * 3)]);
  }
  const textures: THREE.Texture[] = [];
  for (let stage = 0; stage < 10; stage++) {
    const p = new Pixels();
    p.fill(() => [128, 128, 128]);
    const count = Math.floor(((stage + 1) / 10) * segments.length);
    for (let i = 0; i < count; i++) {
      const [x, y] = segments[i];
      p.set(((x % 16) + 16) % 16, ((y % 16) + 16) % 16, i % 3 === 0 ? [40, 40, 40] : [70, 70, 70]);
    }
    const tex = new THREE.CanvasTexture(p.toCanvas());
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    textures.push(tex);
  }
  return textures;
}

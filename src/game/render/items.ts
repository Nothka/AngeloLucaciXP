import { BLOCKS, B, I, SHAPE_CODE, TOOL_INFO, getItem, type ToolMaterial } from "../world/blocks";
import { Pixels, getTextures } from "./textures";

/**
 * Item art. Block items render as little isometric cubes built from their
 * tiles; everything else is a flat 16x16 sprite painted here with an outline
 * pass, the way hand-made item sprites usually read.
 */

type Paint = Map<string, string>;
const key = (x: number, y: number) => `${x},${y}`;

function line(paint: Paint, x0: number, y0: number, x1: number, y1: number, color: (t: number) => string) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= steps; i++) {
    const t = steps ? i / steps : 0;
    paint.set(key(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)), color(t));
  }
}

function finish(paint: Paint, outline: string): Pixels {
  const p = new Pixels();
  for (const [k, c] of paint) {
    const [x, y] = k.split(",").map(Number);
    p.set(x, y, c);
  }
  for (const k of paint.keys()) {
    const [x, y] = k.split(",").map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx > 15 || ny > 15) continue;
      if (!paint.has(key(nx, ny)) && p.alpha(nx, ny) === 0) p.set(nx, ny, outline);
    }
  }
  return p;
}

const handle = (paint: Paint, len = 9) =>
  line(paint, 2, 13, 2 + len, 13 - len, (t) => (Math.round(t * 9) % 3 === 0 ? "#5c4023" : "#8a6339"));

const MATERIALS = {
  wood: { light: "#c39a5e", mid: "#a07b45", dark: "#6e5430" },
  stone: { light: "#a9a9a9", mid: "#868686", dark: "#5c5c5c" },
  iron: { light: "#f0f0f0", mid: "#cfcfcf", dark: "#8f8f8f" },
  gold: { light: "#fff59a", mid: "#f2cf3a", dark: "#b8901a" },
  diamond: { light: "#c8fff8", mid: "#4fe0d4", dark: "#1f9a94" },
};
const MATERIAL_OF: Record<ToolMaterial, (typeof MATERIALS)["wood"]> = {
  wooden: MATERIALS.wood, stone: MATERIALS.stone, iron: MATERIALS.iron, golden: MATERIALS.gold, diamond: MATERIALS.diamond,
};

function pickaxe(m: (typeof MATERIALS)["wood"]) {
  const paint: Paint = new Map();
  handle(paint);
  // Curved head across the top end of the handle.
  const pts = [[3, 3], [4, 2], [5, 2], [6, 1], [7, 1], [8, 1], [9, 2], [10, 2], [11, 3], [12, 4], [13, 5], [13, 6], [14, 7], [14, 8], [13, 9]];
  pts.forEach(([x, y], i) => {
    paint.set(key(x, y), i < 3 || i > 12 ? m.dark : m.light);
    paint.set(key(x, y + 1), m.mid);
  });
  paint.set(key(12, 3), m.light);
  paint.set(key(11, 4), m.mid);
  return finish(paint, "#2a1d10");
}

function axe(m: (typeof MATERIALS)["wood"]) {
  const paint: Paint = new Map();
  handle(paint);
  for (let y = 1; y <= 7; y++) {
    for (let x = 6; x <= 11; x++) {
      const inside = x - 6 + (7 - y) >= 2 && !(x === 11 && y > 5);
      if (!inside) continue;
      paint.set(key(x, y), x <= 7 ? m.dark : y <= 2 ? m.light : m.mid);
    }
  }
  paint.set(key(11, 4), "#8a6339");
  paint.set(key(12, 3), "#8a6339");
  return finish(paint, "#2a1d10");
}

function shovel(m: (typeof MATERIALS)["wood"]) {
  const paint: Paint = new Map();
  handle(paint, 7);
  for (const [x, y, c] of [
    [11, 2, "light"], [12, 2, "light"], [10, 3, "light"], [11, 3, "mid"], [12, 3, "mid"], [13, 3, "mid"],
    [10, 4, "mid"], [11, 4, "mid"], [12, 4, "dark"], [13, 4, "dark"], [11, 5, "dark"], [12, 5, "dark"], [10, 5, "mid"],
  ] as [number, number, keyof typeof m][]) {
    paint.set(key(x, y), m[c]);
  }
  return finish(paint, "#2a1d10");
}

function sword(m: (typeof MATERIALS)["wood"]) {
  const paint: Paint = new Map();
  // Blade: a two-pixel diagonal with a bright edge, ending in a point.
  for (let i = 0; i <= 8; i++) {
    paint.set(key(5 + i, 10 - i), m.light);
    paint.set(key(6 + i, 10 - i), m.mid);
    if (i < 8) paint.set(key(6 + i, 11 - i), m.dark);
  }
  paint.set(key(14, 1), m.light);
  // Cross guard.
  for (const [x, y] of [[2, 8], [3, 9], [4, 10], [5, 11], [6, 12], [7, 13]]) paint.set(key(x, y), x === 2 || x === 7 ? "#3c2b18" : "#5c4023");
  // Grip and pommel.
  paint.set(key(3, 12), "#8a6339");
  paint.set(key(2, 13), "#6b4a2a");
  paint.set(key(1, 14), "#9b733f");
  return finish(paint, "#2a1d10");
}

function hoe(m: (typeof MATERIALS)["wood"]) {
  const paint: Paint = new Map();
  handle(paint);
  // A flat blade bent forward off the top of the handle.
  for (const [x, y, c] of [[8, 3, "dark"], [9, 3, "mid"], [10, 3, "light"], [11, 3, "light"], [12, 4, "mid"], [8, 4, "dark"], [9, 4, "mid"], [10, 4, "mid"]] as [number, number, keyof typeof m][]) {
    paint.set(key(x, y), m[c]);
  }
  return finish(paint, "#2a1d10");
}

/** Generic gem/ingot/lump shapes for the minerals. */
function ingot(light: string, mid: string, dark: string) {
  const paint: Paint = new Map();
  const rows = ["....xxxxxx", "..xxxxxxxx", "xxxxxxxxx.", "xxxxxxx...", "xxxxx....."];
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === "x" && paint.set(key(x + 3, y + 6), y === 0 ? light : y > 3 || x < 2 ? dark : mid)));
  return finish(paint, "#2a2a2a");
}

function gem(light: string, mid: string, dark: string) {
  const paint: Paint = new Map();
  const rows = ["..xxxx..", ".xxxxxx.", "xxxxxxxx", ".xxxxxx.", "..xxxx..", "...xx..."];
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === "x" && paint.set(key(x + 4, y + 5), x + y < 5 ? light : x > 5 ? dark : mid)));
  return finish(paint, "#123a38");
}

function dust(colors: string[]) {
  const paint: Paint = new Map();
  for (const [x, y] of [[6, 9], [7, 8], [8, 9], [9, 8], [10, 9], [5, 10], [7, 10], [9, 10], [11, 10], [6, 11], [8, 11], [10, 11], [8, 7], [7, 12], [9, 12]]) {
    paint.set(key(x, y), colors[(x + y) % colors.length]);
  }
  return finish(paint, "#2a0606");
}

function lump(colors: string[], outline: string) {
  const paint: Paint = new Map();
  const rows = ["..xxxx..", ".xxxxxx.", "xxxxxxxx", "xxxxxxxx", ".xxxxxx.", "..xxxx.."];
  rows.forEach((row, y) => [...row].forEach((ch, x) => ch === "x" && paint.set(key(x + 4, y + 5), colors[(x * 3 + y) % colors.length])));
  return finish(paint, outline);
}

function food(rows: string[], palette: Record<string, string>, outline: string, top = 4) {
  const paint: Paint = new Map();
  rows.forEach((row, y) => [...row].forEach((ch, x) => palette[ch] && paint.set(key(x + Math.round((16 - row.length) / 2), y + top), palette[ch])));
  return finish(paint, outline);
}

function wheatItem() {
  const paint: Paint = new Map();
  for (let i = 0; i < 3; i++) {
    line(paint, 3 + i * 2, 14, 7 + i * 2, 4, () => "#b39a3a");
    for (let k = 0; k < 4; k++) paint.set(key(6 + i * 2 + (k % 2), 3 + k), "#e2c454");
  }
  return finish(paint, "#4a3a10");
}

function seeds() {
  const paint: Paint = new Map();
  for (const [x, y] of [[5, 7], [8, 6], [10, 8], [6, 10], [9, 10], [7, 12], [11, 11], [4, 11]]) {
    paint.set(key(x, y), "#5ca83a");
    paint.set(key(x + 1, y), "#3f8a24");
  }
  return finish(paint, "#1c3a10");
}

/** An iron bucket, empty or holding water or milk. */
function bucket(fill: string | null) {
  const paint: Paint = new Map();
  const rows = ["xxxxxxxxxx", "xwwwwwwwwx", ".xxxxxxxx.", ".xxxxxxxx.", "..xxxxxx..", "..xxxxxx..", "...xxxx..."];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "x") paint.set(key(x + 3, y + 6), x < 3 ? "#e8e8e8" : x > 7 ? "#8f8f8f" : "#c4c4c4");
    if (ch === "w") paint.set(key(x + 3, y + 6), fill ?? "#5a5a5a");
  }));
  line(paint, 3, 5, 6, 2, () => "#9a9a9a");
  line(paint, 12, 5, 9, 2, () => "#9a9a9a");
  line(paint, 6, 2, 9, 2, () => "#9a9a9a");
  return finish(paint, "#2a2a2a");
}

function fishingRod() {
  const paint: Paint = new Map();
  line(paint, 2, 14, 13, 2, (t) => (t < 0.3 ? "#5c4023" : "#8a6339"));
  line(paint, 13, 2, 13, 11, () => "#e6e2d8");
  paint.set(key(13, 12), "#c4c4c4");
  paint.set(key(12, 12), "#c4c4c4");
  return finish(paint, "#2a1d10");
}

function doorItem(iron: boolean) {
  const paint: Paint = new Map();
  for (let y = 1; y < 15; y++) for (let x = 4; x < 12; x++) {
    const edge = x === 4 || x === 11 || y === 1 || y === 14 || y === 8;
    paint.set(key(x, y), iron ? (edge ? "#9a9a9a" : "#d0d0d0") : edge ? "#6b512e" : "#a8844f");
  }
  for (let y = 3; y < 7; y++) for (let x = 6; x < 10; x++) paint.set(key(x, y), iron ? "#3a3a3a" : "#a9c9d4");
  paint.set(key(10, 10), iron ? "#5a5a5a" : "#3a2a18");
  return finish(paint, "#2a2a2a");
}

function leverItem() {
  const paint: Paint = new Map();
  for (let x = 4; x < 12; x++) for (let y = 11; y < 14; y++) paint.set(key(x, y), (x + y) % 3 ? "#8a8a8a" : "#6e6e6e");
  line(paint, 7, 11, 10, 3, () => "#8a6339");
  return finish(paint, "#2a2a2a");
}

function buttonItem() {
  const paint: Paint = new Map();
  for (let x = 5; x < 11; x++) for (let y = 6; y < 10; y++) paint.set(key(x, y), y === 6 ? "#b0b0b0" : "#8a8a8a");
  return finish(paint, "#2a2a2a");
}

function plateItem() {
  const paint: Paint = new Map();
  for (let x = 2; x < 14; x++) for (let y = 9; y < 12; y++) paint.set(key(x, y), y === 9 ? "#b0b0b0" : "#8a8a8a");
  return finish(paint, "#2a2a2a");
}

function stick() {
  const paint: Paint = new Map();
  line(paint, 3, 12, 12, 3, (t) => (t > 0.5 ? "#9b733f" : "#7a5531"));
  line(paint, 4, 12, 12, 4, () => "#5c4023");
  return finish(paint, "#2a1d10");
}

function coal() {
  const paint: Paint = new Map();
  const rows = ["....xxxx....", "..xxxxxxxx..", ".xxxxxxxxxx.", ".xxxxxxxxxxx", "xxxxxxxxxxxx", "xxxxxxxxxxx.", ".xxxxxxxxxx.", "..xxxxxxxx..", "....xxxxx..."];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== "x") return;
      const c = (x + y) % 5 === 0 ? "#4a4a4a" : (x * 3 + y) % 7 === 0 ? "#5a5a5a" : y < 3 ? "#2e2e2e" : "#1d1d1d";
      paint.set(key(x + 2, y + 4), c);
    });
  });
  return finish(paint, "#0a0a0a");
}

function apple() {
  const paint: Paint = new Map();
  const rows = ["...xx.xx...", "..xxxxxxx..", ".xxxxxxxxx.", ".xxxxxxxxx.", ".xxxxxxxxx.", ".xxxxxxxxx.", "..xxxxxxx..", "...xx.xx..."];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== "x") return;
      const c = x <= 3 && y <= 3 ? "#ff6b5e" : x >= 7 || y >= 6 ? "#a3151c" : "#d8262c";
      paint.set(key(x + 2, y + 5), c);
    });
  });
  paint.set(key(4, 6), "#ffd0c4");
  paint.set(key(7, 3), "#5c4023");
  paint.set(key(7, 4), "#5c4023");
  paint.set(key(8, 2), "#4c8e2e");
  paint.set(key(9, 2), "#62a83a");
  paint.set(key(9, 3), "#4c8e2e");
  return finish(paint, "#2a0a0a");
}

function wool() {
  const paint: Paint = new Map();
  const rows = ["..xxxxxx..", ".xxxxxxxx.", "xxxxxxxxxx", "xxxxxxxxxx", "xxxxxxxxxx", "xxxxxxxxxx", ".xxxxxxxx.", "..xxxxxx.."];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "x") paint.set(key(x + 3, y + 4), (x * 3 + y * 5) % 7 < 2 ? "#d9d6cf" : y < 3 ? "#ffffff" : "#efece6");
  }));
  return finish(paint, "#5e5a54");
}

function feather() {
  const paint: Paint = new Map();
  line(paint, 3, 13, 12, 2, () => "#bdb8ae");
  for (let i = 0; i < 8; i++) {
    const x = 5 + i;
    const y = 11 - i;
    paint.set(key(x - 1, y - 1), i % 2 ? "#ffffff" : "#ecebe6");
    paint.set(key(x + 1, y + 1), i % 2 ? "#e3e1da" : "#f8f8f4");
    if (i > 1 && i < 7) paint.set(key(x - 2, y - 1), "#f4f3ef");
  }
  return finish(paint, "#4e4a44");
}

function rawMeat() {
  const paint: Paint = new Map();
  const rows = ["...xxxxx...", "..xxxxxxxx.", ".xxxxxxxxxx", "xxxxxxxxxxx", "xxxxxxxxxx.", ".xxxxxxxx..", "..xxxxx...."];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== "x") return;
    const fat = (x + y * 2) % 6 === 0 || (y === 0 && x > 4);
    paint.set(key(x + 2, y + 5), fat ? "#f3d6c9" : y > 4 ? "#a8323a" : "#d0464e");
  }));
  return finish(paint, "#3a0d10");
}

function bone() {
  const paint: Paint = new Map();
  line(paint, 4, 11, 11, 4, () => "#e9e4d6");
  line(paint, 5, 11, 11, 5, () => "#cfc8b6");
  for (const [x, y] of [[2, 11], [3, 12], [4, 13], [2, 12], [12, 3], [11, 2], [12, 2], [13, 4]]) paint.set(key(x, y), "#f4f0e4");
  return finish(paint, "#5a5446");
}

function stringItem() {
  const paint: Paint = new Map();
  let x = 3;
  for (let y = 2; y < 14; y++) {
    paint.set(key(x, y), y % 3 ? "#f2f0ea" : "#d8d4ca");
    x += y % 2 ? 1 : 0;
    if (y === 8) x -= 2;
  }
  line(paint, 9, 9, 12, 13, () => "#e6e2d8");
  return finish(paint, "#4e4a44");
}

function arrow() {
  const paint: Paint = new Map();
  line(paint, 3, 12, 11, 4, () => "#8a6339");
  for (const [x, y] of [[11, 3], [12, 3], [12, 4], [13, 2], [11, 2], [12, 2], [10, 4]]) paint.set(key(x, y), x + y === 15 ? "#cfcfcf" : "#8e8e8e");
  for (const [x, y] of [[2, 11], [2, 12], [3, 13], [4, 13], [1, 12], [3, 14]]) paint.set(key(x, y), "#f4f2ec");
  return finish(paint, "#2a1d10");
}

function bow(draw = 0) {
  const paint: Paint = new Map();
  // Limbs: a curve from bottom-left to top-right.
  const pts = [[3, 13], [4, 12], [5, 12], [6, 11], [7, 11], [8, 10], [9, 9], [10, 8], [11, 7], [11, 6], [12, 5], [12, 4], [13, 3]];
  pts.forEach(([x, y], i) => paint.set(key(x - 1, y - 1), i % 4 === 0 ? "#5c4023" : "#8a6339"));
  // String, pulled back by `draw` pixels.
  const pull = Math.round(draw * 3);
  line(paint, 2 - pull + 1, 12 + pull - 1, 12 - pull + 1, 2 + pull - 1, () => "#e9e6dd");
  return finish(paint, "#2a1d10");
}

function armor(slot: number) {
  const paint: Paint = new Map();
  const rows = [
    ["....xxxx....", "..xxxxxxxx..", ".xxxxxxxxxx.", ".xxx....xxx.", ".xx......xx.", ".xx......xx."],
    ["xxx......xxx", "xxxx....xxxx", "xxxxxxxxxxxx", ".xxxxxxxxxx.", "..xxxxxxxx..", "..xxxxxxxx..", "..xxxxxxxx..", "..xxxxxxxx..", "..xxxxxxxx.."],
    ["xxxxxxxxxxxx", "xxxxxxxxxxxx", "xxxx....xxxx", "xxx......xxx", "xxx......xxx", "xxx......xxx", "xxx......xxx", "xxx......xxx"],
    [".xxx....xxx.", ".xxx....xxx.", ".xxx....xxx.", "xxxx...xxxxx", "xxxx...xxxxx"],
  ][slot];
  const top = Math.round((16 - rows.length) / 2);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === "x") paint.set(key(x + 2, y + top), y === 0 || x === 0 ? "#f2f2f2" : (x + y) % 5 === 0 ? "#9a9a9a" : "#cfcfcf");
  }));
  return finish(paint, "#2e2e2e");
}

/** Bow sprites at four draw stages, for the held view while charging. */
export function bowSprite(draw: number) {
  return bow(draw);
}

const spriteCache = new Map<number, Pixels>();

/** Flat sprite for an item (plants and torches use their block tile). */
export function itemSprite(id: number): Pixels {
  const cached = spriteCache.get(id);
  if (cached) return cached;
  let p: Pixels;
  switch (id) {
    case I.STICK: p = stick(); break;
    case I.COAL: p = coal(); break;
    case I.APPLE: p = apple(); break;
    case I.WOOL: p = wool(); break;
    case I.FEATHER: p = feather(); break;
    case I.RAW_MEAT: p = rawMeat(); break;
    case I.BONE: p = bone(); break;
    case I.STRING: p = stringItem(); break;
    case I.ARROW: p = arrow(); break;
    case I.BOW: p = bow(); break;
    case I.IRON_HELMET: p = armor(0); break;
    case I.IRON_CHESTPLATE: p = armor(1); break;
    case I.IRON_LEGGINGS: p = armor(2); break;
    case I.IRON_BOOTS: p = armor(3); break;
    case I.IRON_INGOT: p = ingot("#ffffff", "#d8d8d8", "#9a9a9a"); break;
    case I.GOLD_INGOT: p = ingot("#fff8b0", "#f2cf3a", "#b8901a"); break;
    case I.BRICK: p = ingot("#d2785c", "#a4503a", "#7a3424"); break;
    case I.DIAMOND: p = gem("#e4fffc", "#5ae8e0", "#1f9a94"); break;
    case I.LAPIS: p = lump(["#2a52c8", "#1c3c9a", "#4a72e8"], "#0a1440"); break;
    case I.REDSTONE: p = dust(["#ff3a2a", "#c41a12", "#8a0e0a"]); break;
    case I.CLAY_BALL: p = lump(["#a4a8b8", "#b4b8c6", "#8e92a2"], "#3a3c46"); break;
    case I.FLINT: p = lump(["#3a3a3a", "#5a5a5a", "#2a2a2a"], "#101010"); break;
    case I.WHEAT: p = wheatItem(); break;
    case I.SEEDS: p = seeds(); break;
    case I.EGG: p = food(["..xxxx..", ".xxxxxx.", ".xyxxxx.", "xyxxxxxx", "xxxxxxxx", "xxxxxxxz", ".xxxxxz.", "..zzzz.."], { x: "#e9dcc0", y: "#fbf5e6", z: "#c7b48f" }, "#5a4a30", 4); break;
    case I.BREAD: p = food(["..xxxxxxxx..", ".xyxxyxxyxx.", "xxxxxxxxxxxx", "xxxxxxxxxxxx", ".zzzzzzzzzz."], { x: "#c8862f", y: "#e8b860", z: "#9a5f22" }, "#3a2008", 6); break;
    case I.RAW_PORKCHOP: p = food(["..xxxxx..", ".xxxxxxx.", "xxxyxxxxx", "xxxxxxxyx", ".xxxxxxx.", "..xxxxx.."], { x: "#f0a0a0", y: "#ffffff" }, "#5a1a1a", 5); break;
    case I.COOKED_PORKCHOP: p = food(["..xxxxx..", ".xxxxxxx.", "xxxyxxxxx", "xxxxxxxyx", ".xxxxxxx.", "..xxxxx.."], { x: "#c8864a", y: "#f2d8b0" }, "#3a1a08", 5); break;
    case I.STEAK: p = food(["...xxxxx...", ".xxxxxxxxx.", "xxxxxyxxxxx", "xxxxxxxxxx.", ".xxxxxxxx..", "..xxxxx...."], { x: "#8a4a2a", y: "#c8864a" }, "#2a1008", 5); break;
    case I.RAW_CHICKEN: p = food(["...xx....", "..xxxx...", ".xxxxxxx.", "xxxxxxxxx", ".xxxxxxx.", "..xx..xx."], { x: "#f2c8b4" }, "#6a3a2a", 5); break;
    case I.COOKED_CHICKEN: p = food(["...xx....", "..xxxx...", ".xxxxxxx.", "xxxxxxxxx", ".xxxxxxx.", "..xx..xx."], { x: "#c88a4a" }, "#3a1a08", 5); break;
    case I.RAW_FISH: p = food(["....xxxxx..x", "..xxxxxxxxxx", "xyxxxxxxxxx.", "..xxxxxxxxxx", "....xxxxx..x"], { x: "#7aa0b8", y: "#101010" }, "#1a2a3a", 6); break;
    case I.COOKED_FISH: p = food(["....xxxxx..x", "..xxxxxxxxxx", "xyxxxxxxxxx.", "..xxxxxxxxxx", "....xxxxx..x"], { x: "#c8a46a", y: "#101010" }, "#3a2a10", 6); break;
    case I.BUCKET: p = bucket(null); break;
    case I.WATER_BUCKET: p = bucket("#3a6ee0"); break;
    case I.MILK_BUCKET: p = bucket("#f4f4ee"); break;
    case I.FISHING_ROD: p = fishingRod(); break;
    case I.WOODEN_DOOR: p = doorItem(false); break;
    case I.IRON_DOOR: p = doorItem(true); break;
    case B.LEVER: p = leverItem(); break;
    case B.BUTTON: p = buttonItem(); break;
    case B.PRESSURE_PLATE: p = plateItem(); break;
    default: {
      const tool = TOOL_INFO.get(id);
      if (tool) {
        const m = MATERIAL_OF[tool.material];
        p = tool.kind === "pickaxe" ? pickaxe(m) : tool.kind === "axe" ? axe(m) : tool.kind === "shovel" ? shovel(m) : tool.kind === "sword" ? sword(m) : hoe(m);
        break;
      }
      const def = BLOCKS[id];
      p = def ? getTextures().tiles[def.tiles.side] : new Pixels();
    }
  }
  spriteCache.set(id, p);
  return p;
}

/** Items that render as a flat sprite (in hand, as drops and as icons). */
export function isFlatItem(id: number) {
  const item = getItem(id);
  if (!item?.block) return true;
  const shape = SHAPE_CODE[item.block];
  return shape !== 1;
}

const iconCache = new Map<number, string>();
const shadedCache = new Map<string, HTMLCanvasElement>();

function shadedTile(tile: number, k: number) {
  const id = `${tile}:${k}`;
  let c = shadedCache.get(id);
  if (!c) {
    const src = getTextures().tiles[tile];
    const p = new Pixels();
    p.data.set(src.data);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (p.alpha(x, y)) p.shade(x, y, k);
    c = p.toCanvas();
    shadedCache.set(id, c);
  }
  return c;
}

/** 64x64 data URL used by every inventory slot and the hotbar. */
export function itemIcon(id: number): string {
  const cached = iconCache.get(id);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  if (isFlatItem(id)) {
    ctx.drawImage(itemSprite(id).toCanvas(), 0, 0, 64, 64);
  } else {
    const def = BLOCKS[getItem(id)!.block!];
    const s = 64 / 32;
    // Top, left and right faces of an isometric cube, each an affine map of a 16x16 tile.
    ctx.setTransform((15 / 16) * s, (7.5 / 16) * s, (-15 / 16) * s, (7.5 / 16) * s, 16 * s, 1 * s);
    ctx.drawImage(shadedTile(def.tiles.top, 1), 0, 0);
    ctx.setTransform((15 / 16) * s, (7.5 / 16) * s, 0, s, 1 * s, 8.5 * s);
    ctx.drawImage(shadedTile(def.tiles.front ?? def.tiles.side, 0.78), 0, 0);
    ctx.setTransform((15 / 16) * s, (-7.5 / 16) * s, 0, s, 16 * s, 16 * s);
    ctx.drawImage(shadedTile(def.tiles.side, 0.6), 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  const url = canvas.toDataURL();
  iconCache.set(id, url);
  return url;
}

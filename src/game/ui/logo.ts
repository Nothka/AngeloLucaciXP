import { hash2 } from "../noise";

/** 5x7 bitmap glyphs for the wordmark. */
const GLYPHS: Record<string, string[]> = {
  B: ["1111.", "1...1", "1...1", "1111.", "1...1", "1...1", "1111."],
  L: ["1....", "1....", "1....", "1....", "1....", "1....", "11111"],
  O: [".111.", "1...1", "1...1", "1...1", "1...1", "1...1", ".111."],
  C: [".1111", "1....", "1....", "1....", "1....", "1....", ".1111"],
  K: ["1...1", "1..1.", "1.1..", "11...", "1.1..", "1..1.", "1...1"],
  V: ["1...1", "1...1", "1...1", "1...1", ".1.1.", ".1.1.", "..1.."],
  A: [".111.", "1...1", "1...1", "11111", "1...1", "1...1", "1...1"],
  E: ["11111", "1....", "1....", "1111.", "1....", "1....", "11111"],
};

const CELL = 6;
const STONE = ["#9a978f", "#8c8981", "#a7a49c", "#827f78"];
const GRASS = ["#6fb744", "#62a83a", "#7cc24e"];

/**
 * The Blockvale wordmark: extruded pixel letters, grass on the top row of
 * every glyph and stone below, drawn as crisp SVG rects.
 */
export function logoSvg(text = "BLOCKVALE"): string {
  const pixels: [number, number][] = [];
  let cursor = 0;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) {
      cursor += 4;
      continue;
    }
    g.forEach((row, y) => [...row].forEach((v, x) => v === "1" && pixels.push([cursor + x, y])));
    cursor += 6;
  }
  const width = (cursor - 1) * CELL;
  const depth = 4;
  const set = new Set(pixels.map(([x, y]) => `${x},${y}`));
  const has = (x: number, y: number) => set.has(`${x},${y}`);
  const rects: string[] = [];
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    rects.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`);

  // Extrusion, back to front, gives the letters their depth.
  for (let d = depth; d >= 1; d--) {
    const shade = d === depth ? "#1d1a17" : d > 1 ? "#3a352f" : "#4d473f";
    for (const [x, y] of pixels) rect(x * CELL + d, y * CELL + d, CELL, CELL, shade);
  }
  for (const [x, y] of pixels) {
    const topRow = !has(x, y - 1);
    const sub = CELL / 2;
    for (let sy = 0; sy < 2; sy++) {
      for (let sx = 0; sx < 2; sx++) {
        const h = hash2(1234, x * 2 + sx, y * 2 + sy);
        const grassy = y === 0 ? sy === 0 || h < 0.45 : y === 1 && sy === 0 && h < 0.3;
        const palette = grassy ? GRASS : STONE;
        rect(x * CELL + sx * sub, y * CELL + sy * sub, sub, sub, palette[Math.floor(h * palette.length)]);
      }
    }
    if (topRow) rect(x * CELL, y * CELL, CELL, 1, y === 0 ? "#a5e07a" : "#c4c1b9");
    else if (!has(x - 1, y)) rect(x * CELL, y * CELL, 1, CELL, "#bab7af");
    if (!has(x, y + 1)) rect(x * CELL, y * CELL + CELL - 1, CELL, 1, "#5f5c56");
  }
  const h = 7 * CELL + depth;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width + depth} ${h}" shape-rendering="crispEdges" role="img" aria-label="Blockvale">${rects.join("")}</svg>`;
}

export const SPLASHES = [
  "Now with 100% more blocks!",
  "Handcrafted pixels!",
  "Runs in a browser!",
  "Dig responsibly!",
  "Infinite-ish!",
  "Punch a tree!",
  "Sixteen by sixteen!",
  "Greedy meshing inside!",
  "Zero image files!",
  "Seeded with care!",
  "Also on Windows XP!",
  "Press E to craft!",
  "Torches sold separately!",
  "Procedurally pleasant!",
  "Mind the caves!",
  "Hello, desktop!",
];

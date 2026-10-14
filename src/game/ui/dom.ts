import { mulberry32 } from "../noise";
import { Pixels, getTextures } from "../render/textures";

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

/** Tiny element factory: h("div.bv-btn", { onclick }, "Play"). */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K | `${K}.${string}`, attrs: Attrs = {}, ...children: (Node | string | null | undefined)[]): HTMLElementTagNameMap[K] {
  const [name, ...classes] = tag.split(".");
  const el = document.createElement(name as K);
  if (classes.length) el.className = classes.join(" ");
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "style" && typeof v === "string") el.style.cssText = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children) if (c !== null && c !== undefined) el.append(c);
  return el;
}

export const px = (n: number) => `calc(var(--s) * ${n})`;

let currentScale = 2;
export const guiScale = () => currentScale;

/** Picks an integer GUI scale for the viewport, like a pixel game's "Auto" setting. */
export function updateGuiScale(root: HTMLElement) {
  const s = Math.max(1, Math.min(4, Math.floor(Math.min(window.innerWidth / 320, window.innerHeight / 240))));
  currentScale = s;
  root.style.setProperty("--s", `${s}px`);
}

let clickSound: (() => void) | null = null;
export const setClickSound = (fn: () => void) => {
  clickSound = fn;
};

export function button(label: string, onClick: () => void, cls = ""): HTMLButtonElement {
  return h(`button.bv-btn${cls ? "." + cls : ""}` as "button", {
    type: "button",
    onclick: () => {
      clickSound?.();
      onClick();
    },
  }, label);
}

/** Pixel-styled slider; `format` renders the label from the current value. */
export function slider(
  min: number, max: number, step: number, value: number,
  format: (v: number) => string, onInput: (v: number) => void, cls = "",
): HTMLDivElement {
  const label = h("div.bv-slider-label.bv-text");
  const thumb = h("div.bv-slider-thumb");
  const el = h(`div.bv-slider${cls ? "." + cls : ""}` as "div", { role: "slider", tabindex: 0 }, thumb, label);
  let current = value;
  const render = () => {
    const t = (current - min) / (max - min);
    thumb.style.left = `calc((100% - var(--s) * 8 + var(--s) * 2) * ${t} - var(--s))`;
    label.textContent = format(current);
    el.setAttribute("aria-valuenow", String(current));
  };
  const setFromX = (clientX: number) => {
    const r = el.getBoundingClientRect();
    const thumbW = r.height * 0.4;
    const t = Math.max(0, Math.min(1, (clientX - r.left - thumbW / 2) / (r.width - thumbW)));
    const v = Math.round((min + t * (max - min)) / step) * step;
    const clamped = Math.max(min, Math.min(max, Number(v.toFixed(4))));
    if (clamped !== current) {
      current = clamped;
      onInput(current);
      render();
    }
  };
  el.addEventListener("pointerdown", (e) => {
    el.setPointerCapture(e.pointerId);
    setFromX(e.clientX);
    const move = (ev: PointerEvent) => setFromX(ev.clientX);
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      clickSound?.();
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      current = Math.max(min, Math.min(max, current + (e.key === "ArrowLeft" ? -step : step)));
      onInput(current);
      render();
      e.preventDefault();
    }
  });
  render();
  return el;
}

/** Paints the UI's own textures once and exposes them as CSS variables. */
export function installUiTextures(root: HTMLElement) {
  const rand = mulberry32(77);
  const btn = new Pixels();
  btn.fill(() => {
    const v = 98 + Math.floor(rand() * 18);
    return [v, v - 3, v - 8];
  });
  root.style.setProperty("--bv-btn-texture", `url(${btn.toCanvas().toDataURL()})`);

  const dirt = getTextures().tiles[2];
  root.style.setProperty("--bv-dirt-texture", `url(${dirt.toCanvas().toDataURL()})`);

  // Hotbar: 182 x 22, nine 20px cells.
  const bar = new Pixels(182, 22);
  for (let y = 0; y < 22; y++) {
    for (let x = 0; x < 182; x++) {
      const edge = x === 0 || y === 0 || x === 181 || y === 21;
      if (edge) { bar.set(x, y, "#0c0b0a", 230); continue; }
      const cx = (x - 1) % 20;
      const cy = y - 1;
      if (cx === 0 || cy === 0) bar.set(x, y, "#2b2a28", 200);
      else if (cx === 19 || cy === 19) bar.set(x, y, "#8d8a84", 200);
      else if (cx === 1 || cy === 1) bar.set(x, y, "#3d3b38", 170);
      else bar.set(x, y, "#5c5a56", 140);
    }
  }
  root.style.setProperty("--bv-hotbar-texture", `url(${bar.toCanvas().toDataURL()})`);

  const sel = new Pixels(24, 24);
  for (let y = 0; y < 24; y++) {
    for (let x = 0; x < 24; x++) {
      const d = Math.min(x, y, 23 - x, 23 - y);
      if (d === 0) sel.set(x, y, "#000000", 255);
      else if (d === 1) sel.set(x, y, "#ffffff", 255);
      else if (d === 2) sel.set(x, y, "#a9a9a9", 255);
    }
  }
  for (const [x, y] of [[0, 0], [23, 0], [0, 23], [23, 23]]) sel.set(x, y, "#000000", 0);
  root.style.setProperty("--bv-selector-texture", `url(${sel.toCanvas().toDataURL()})`);

  const arrow = new Pixels(22, 15);
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 22; x++) {
      const shaft = x < 14 && y >= 5 && y <= 9;
      const head = x >= 14 && Math.abs(y - 7) <= 21 - x;
      if (shaft || head) arrow.set(x, y, "#8b877f");
    }
  }
  root.style.setProperty("--bv-arrow-texture", `url(${arrow.toCanvas().toDataURL()})`);

  // Status icons (9x9): hearts, food and air bubbles, each full / half / empty.
  const icon = (mask: string[], fill: (x: number, y: number) => string | null, outline: string) => {
    const p = new Pixels(9, 9);
    const inside = (x: number, y: number) => mask[y]?.[x] === "o";
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        if (inside(x, y)) {
          const c = fill(x, y);
          if (c) p.set(x, y, c);
          else p.set(x, y, "#1c1414");
        } else if (inside(x + 1, y) || inside(x - 1, y) || inside(x, y + 1) || inside(x, y - 1)) {
          p.set(x, y, outline);
        }
      }
    }
    return `url(${p.toCanvas().toDataURL()})`;
  };
  const HEART = [".........", ".oo...oo.", ".ooo.ooo.", ".ooooooo.", "..ooooo..", "...ooo...", "....o....", ".........", "........."];
  const heartFill = (x: number, y: number) => (x === 2 && y === 2) || (x === 2 && y === 1) ? "#ffb4b4" : y >= 4 || x >= 6 ? "#b0161c" : "#e3262c";
  root.style.setProperty("--bv-heart-full", icon(HEART, heartFill, "#1a0505"));
  root.style.setProperty("--bv-heart-half", icon(HEART, (x, y) => (x <= 4 ? heartFill(x, y) : null), "#1a0505"));
  root.style.setProperty("--bv-heart-empty", icon(HEART, () => null, "#1a0505"));

  // A crusty loaf for the hunger bar.
  const LOAF = [".........", ".........", "...ooo...", ".ooooooo.", ".ooooooo.", ".ooooooo.", "..ooooo..", ".........", "........."];
  const loafFill = (x: number, y: number) =>
    y === 2 || (y === 3 && x < 4) ? "#eeb15c" : (y === 4 && (x === 3 || x === 5)) ? "#8a5320" : y >= 5 ? "#9a5f22" : "#c8822f";
  root.style.setProperty("--bv-food-full", icon(LOAF, loafFill, "#2a1606"));
  root.style.setProperty("--bv-food-half", icon(LOAF, (x, y) => (x >= 4 ? loafFill(x, y) : null), "#2a1606"));
  root.style.setProperty("--bv-food-empty", icon(LOAF, () => null, "#2a1606"));

  // Armor: a little chestplate, full / half / empty.
  const PLATE = [".........", ".oo...oo.", ".ooooooo.", ".ooooooo.", "..ooooo..", "..ooooo..", "..ooooo..", ".........", "........."];
  const plateFill = (x: number, y: number) => (y === 1 || x === 2 ? "#f4f4f4" : (x + y) % 4 === 0 ? "#9a9a9a" : "#cfcfcf");
  root.style.setProperty("--bv-armor-full", icon(PLATE, plateFill, "#1e1e1e"));
  root.style.setProperty("--bv-armor-half", icon(PLATE, (x, y) => (x <= 4 ? plateFill(x, y) : null), "#1e1e1e"));
  root.style.setProperty("--bv-armor-empty", icon(PLATE, () => null, "#1e1e1e"));

  const BUBBLE = [".........", "...ooo...", "..ooooo..", ".ooooooo.", ".ooooooo.", ".ooooooo.", "..ooooo..", "...ooo...", "........."];
  const bubbleFill = (x: number, y: number) => ((x === 3 && y === 2) || (x === 2 && y === 3) ? "#ffffff" : "#5d9cff");
  root.style.setProperty("--bv-bubble", icon(BUBBLE, bubbleFill, "#0e2c66"));

  // Achievement frames (26x26): rounded squares, and spiky ones for challenges.
  const FRAME_COLORS = {
    unlocked: { fill: "#d9a930", light: "#ffe38a", dark: "#7c5814" },
    available: { fill: "#b9b5ad", light: "#f4f1ea", dark: "#5f5b54" },
    locked: { fill: "#4a4744", light: "#6c6964", dark: "#262422" },
  };
  for (const [status, c] of Object.entries(FRAME_COLORS)) {
    for (const challenge of [false, true]) {
      const p = new Pixels(26, 26);
      for (let y = 0; y < 26; y++) {
        for (let x = 0; x < 26; x++) {
          const d = Math.min(x, y, 25 - x, 25 - y);
          const corner = Math.min(x, 25 - x) + Math.min(y, 25 - y);
          // Challenge frames get notched corners and a spike midway along each edge.
          const spike = challenge && d <= 2 && (Math.abs(x - 12.5) < 2 || Math.abs(y - 12.5) < 2);
          const inside = challenge ? d >= 2 || spike : corner >= 2;
          if (!inside) continue;
          const edge = challenge ? (spike ? d === 0 : d === 2) : d === 0 || corner === 2;
          const bevel = d <= (challenge ? 3 : 1);
          if (edge) p.set(x, y, "#050505");
          else if (bevel) p.set(x, y, x + y < 25 ? c.light : c.dark);
          else p.set(x, y, c.fill);
        }
      }
      root.style.setProperty(`--bv-frame-${status}${challenge ? "-challenge" : ""}`, `url(${p.toCanvas().toDataURL()})`);
    }
  }
}

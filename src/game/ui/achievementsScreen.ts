import { ACHIEVEMENTS, requiredCount, type AchievementDef } from "../achievements/achievements";
import { statusOf, type AchievementState } from "../achievements/tracker";
import { itemIcon } from "../render/items";
import { getTextures } from "../render/textures";
import { guiScale, h, px } from "./dom";

const NODE = 26;
const COL = 42;
const ROW = 30;
const PAD = 24;

const tileIconCache = new Map<number, string>();
function iconUrl(def: AchievementDef) {
  if ("item" in def.icon) return itemIcon(def.icon.item);
  const tile = def.icon.tile;
  let url = tileIconCache.get(tile);
  if (!url) {
    url = getTextures().tiles[tile].toCanvas(4).toDataURL();
    tileIconCache.set(tile, url);
  }
  return url;
}

interface Placed {
  def: AchievementDef;
  x: number;
  y: number;
}

/** Tidy tree: each leaf gets its own row, parents sit centred on their children. */
function layout(state: AchievementState): { nodes: Placed[]; width: number; height: number } {
  const visible = ACHIEVEMENTS.filter((a) => !a.hidden || state.unlocked[a.id]);
  const ids = new Set(visible.map((a) => a.id));
  const children = new Map<string | null, AchievementDef[]>();
  for (const a of visible) {
    const parent = a.parentId && ids.has(a.parentId) ? a.parentId : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(a);
  }
  const placed = new Map<string, Placed>();
  let nextRow = 0;
  let maxDepth = 0;
  const visit = (def: AchievementDef, depth: number): number => {
    maxDepth = Math.max(maxDepth, depth);
    const kids = children.get(def.id) ?? [];
    let row: number;
    if (!kids.length) row = nextRow++;
    else {
      const rows = kids.map((k) => visit(k, depth + 1));
      row = (rows[0] + rows[rows.length - 1]) / 2;
    }
    placed.set(def.id, { def, x: PAD + depth * COL, y: PAD + row * ROW });
    return row;
  };
  for (const root of children.get(null) ?? []) visit(root, 0);
  return {
    nodes: [...placed.values()],
    width: PAD * 2 + maxDepth * COL + NODE + 140,
    height: PAD * 2 + Math.max(0, nextRow - 1) * ROW + NODE,
  };
}

export interface AchievementsScreenOptions {
  state: AchievementState;
  worldName: string | null;
  inGame: boolean;
  onDone: () => void;
  /** Title-screen only: cycle between saved worlds. */
  switcher?: { label: string; next: () => void } | null;
  emptyNote?: string;
}

/** Pannable, zoomable achievement tree with parent→child connectors. */
export function achievementsScreen(opts: AchievementsScreenOptions): HTMLElement {
  const { state } = opts;
  const { nodes, width, height } = layout(state);
  const byId = new Map(nodes.map((n) => [n.def.id, n]));
  const unlocked = ACHIEVEMENTS.filter((a) => state.unlocked[a.id]).length;

  // Connectors: out of the parent's right edge, down a shared trunk, into the child.
  const lines: string[] = [];
  for (const n of nodes) {
    const parent = n.def.parentId ? byId.get(n.def.parentId) : null;
    if (!parent) continue;
    const x1 = parent.x + NODE;
    const y1 = parent.y + NODE / 2;
    const x2 = n.x;
    const y2 = n.y + NODE / 2;
    const mid = x2 - (COL - NODE) / 2;
    const pts = `${x1},${y1} ${mid},${y1} ${mid},${y2} ${x2},${y2}`;
    lines.push(`<polyline points="${pts}" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="miter"/>`);
    const lit = state.unlocked[n.def.id] ? "#ffe58a" : "#ffffff";
    lines.push(`<polyline points="${pts}" fill="none" stroke="${lit}" stroke-width="1" stroke-linejoin="miter"/>`);
  }
  const svg = `<svg class="bv-ach-lines" viewBox="0 0 ${width} ${height}" width="100%" height="100%" shape-rendering="crispEdges">${lines.join("")}</svg>`;

  const map = h("div.bv-ach-map", { style: `width:${px(width)};height:${px(height)}` });
  map.innerHTML = svg;
  const tooltip = h("div.bv-ach-tip.bv-text.bv-hidden");

  for (const n of nodes) {
    const status = statusOf(n.def, state);
    const node = h(`div.bv-ach-node.is-${status}${n.def.challenge ? ".is-challenge" : ""}` as "div", {
      style: `left:${px(n.x)};top:${px(n.y)}`,
    }, h("img", { src: iconUrl(n.def), alt: "", draggable: "false" }));
    node.addEventListener("pointerenter", () => {
      const need = requiredCount(n.def);
      const progress = state.progress[n.def.id] ?? 0;
      const lines: HTMLElement[] = [h(`div.bv-ach-tip-title.is-${status}${n.def.challenge ? ".is-challenge" : ""}` as "div", {}, n.def.title), h("div", {}, n.def.description)];
      if (status === "unlocked") lines.push(h("small", {}, `Unlocked ${new Date(state.unlocked[n.def.id]).toLocaleDateString()}`));
      else if (need > 1) lines.push(h("small", {}, `Progress: ${progress} / ${need}`));
      else if (status === "locked") lines.push(h("small", {}, "Unlock the previous step first"));
      tooltip.replaceChildren(...lines);
      tooltip.classList.remove("bv-hidden");
      tooltip.style.left = px(n.x + NODE + 4);
      tooltip.style.top = px(n.y);
    });
    node.addEventListener("pointerleave", () => tooltip.classList.add("bv-hidden"));
    map.append(node);
  }
  map.append(tooltip);

  const viewport = h("div.bv-ach-viewport", {}, map);
  // Pan with drag, zoom with the wheel around the cursor.
  const view = { x: 0, y: 0, zoom: 1 };
  const apply = () => (map.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`);
  // Open centred vertically on the root, so the start of every branch is in view.
  requestAnimationFrame(() => {
    const vr = viewport.getBoundingClientRect();
    const s = guiScale();
    const root = nodes.find((n) => !n.def.parentId);
    const mapH = height * s;
    view.x = 0;
    view.y = mapH <= vr.height ? (vr.height - mapH) / 2 : Math.min(0, Math.max(vr.height - mapH, vr.height / 2 - ((root?.y ?? 0) + NODE / 2) * s));
    apply();
  });
  let drag: { x: number; y: number; vx: number; vy: number } | null = null;
  viewport.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    viewport.setPointerCapture(e.pointerId);
    viewport.classList.add("is-dragging");
  });
  viewport.addEventListener("pointermove", (e) => {
    if (!drag) return;
    view.x = drag.vx + e.clientX - drag.x;
    view.y = drag.vy + e.clientY - drag.y;
    apply();
  });
  const endDrag = () => {
    drag = null;
    viewport.classList.remove("is-dragging");
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const next = Math.max(0.5, Math.min(2.5, view.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
    view.x = cx - ((cx - view.x) * next) / view.zoom;
    view.y = cy - ((cy - view.y) * next) / view.zoom;
    view.zoom = next;
    apply();
  }, { passive: false });

  const header = h("div.bv-ach-header", {},
    h("div.bv-text", {}, opts.worldName ? `Achievements · ${opts.worldName}` : "Achievements"),
    h("div.bv-text.bv-ach-count", {}, `${unlocked} / ${ACHIEVEMENTS.length}`),
  );
  const panel = h("div.bv-ach-panel", {}, header, viewport);
  if (opts.emptyNote) viewport.append(h("div.bv-ach-empty.bv-text", {}, opts.emptyNote));
  const done = h("button.bv-btn", { type: "button", onclick: opts.onDone }, "Done");
  const footer = h("div.bv-row", {}, done);
  if (opts.switcher) {
    const sw = opts.switcher;
    footer.prepend(h("button.bv-btn.is-wide", { type: "button", onclick: sw.next }, sw.label));
  }
  return h(`div.bv-screen.${opts.inGame ? "is-ingame" : "is-dim"}` as "div", { style: "justify-content:center" },
    panel,
    h("div", { style: `height:${px(8)}` }),
    footer,
  );
}

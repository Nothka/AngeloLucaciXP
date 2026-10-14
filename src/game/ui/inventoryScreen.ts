import { CREATIVE_ITEMS, I, getItem } from "../world/blocks";
import { itemIcon } from "../render/items";
import { matchRecipe } from "../items/crafting";
import { SMELT_SECONDS, fuelSeconds, smeltResult } from "../items/smelting";
import type { FurnaceState } from "../world/furnaces";
import { INVENTORY_SIZE, maxStack, type Inventory, type ItemStack } from "../items/inventory";
import { playerPortrait } from "./playerPortrait";
import { h, px } from "./dom";
import { renderStack } from "./hud";

export type ContainerMode = "inventory" | "crafting" | "creative" | "furnace";

/** Visible rows of the creative palette; the wheel or scrollbar moves through the rest. */
const PALETTE_ROWS = 5;
const PALETTE_ROWS_TOTAL = Math.ceil(CREATIVE_ITEMS.length / 9);

export interface ContainerHost {
  inventory: Inventory;
  dropStack(stack: ItemStack): void;
  onCraft(result: ItemStack): void;
  onSlotClick(): void;
  /** Output taken from a furnace (pays out its experience). */
  onSmeltTake?(furnace: FurnaceState, taken: ItemStack): void;
}

type SlotRef =
  | { kind: "inv"; index: number }
  | { kind: "grid"; index: number }
  | { kind: "out" }
  | { kind: "pal"; index: number }
  | { kind: "armor"; index: number }
  /** 0 input, 1 fuel, 2 output. */
  | { kind: "furnace"; index: number };

const ARMOR_OUTLINES = [I.IRON_HELMET, I.IRON_CHESTPLATE, I.IRON_LEGGINGS, I.IRON_BOOTS];
const armorSlotOf = (id: number) => getItem(id)?.armor?.slot;

const refKey = (r: SlotRef) => ("index" in r ? `${r.kind}:${r.index}` : r.kind);

/** Inventory, crafting table and creative screens with click/shift-click/right-click stack handling. */
export class InventoryScreen {
  readonly el: HTMLDivElement;
  mode: ContainerMode = "inventory";
  isOpen = false;
  private panel!: HTMLDivElement;
  private grid: (ItemStack | null)[] = [];
  private gridSize = 2;
  private result: ItemStack | null = null;
  private cursor: ItemStack | null = null;
  private slotEls = new Map<string, { el: HTMLElement; ref: SlotRef }>();
  private cursorEl: HTMLDivElement;
  private tooltip: HTMLDivElement;
  private hovered: SlotRef | null = null;
  private mouse = { x: 0, y: 0 };
  private unsub: (() => void) | null = null;
  private furnace: FurnaceState | null = null;
  private flameFill: HTMLDivElement | null = null;
  private arrowFill: HTMLDivElement | null = null;
  private scroll = 0;
  private thumb: HTMLDivElement | null = null;

  constructor(private host: ContainerHost) {
    this.cursorEl = h("div.bv-cursor-item");
    this.tooltip = h("div.bv-tooltip.bv-text.bv-hidden");
    this.el = h("div.bv-layer.bv-hidden");
    this.el.addEventListener("mousemove", (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (this.mode === "inventory") playerPortrait().lookAt(e.clientX, e.clientY);
      this.cursorEl.style.left = `${e.clientX}px`;
      this.cursorEl.style.top = `${e.clientY}px`;
      this.positionTooltip();
    });
    this.el.addEventListener("contextmenu", (e) => e.preventDefault());
    this.el.addEventListener("wheel", (e) => {
      if (this.mode !== "creative") return;
      e.preventDefault();
      this.scrollTo(this.scroll + Math.sign(e.deltaY));
    }, { passive: false });
  }

  private scrollTo(row: number) {
    const max = Math.max(0, PALETTE_ROWS_TOTAL - PALETTE_ROWS);
    this.scroll = Math.max(0, Math.min(max, row));
    if (this.thumb) this.thumb.style.top = px(1 + (max ? (this.scroll / max) * (PALETTE_ROWS * 18 - 17) : 0));
    this.render();
  }

  private palItem(index: number): number | null {
    return CREATIVE_ITEMS[this.scroll * 9 + index] ?? null;
  }

  /** Opens a screen; the furnace screen works on that furnace's own slots. */
  open(mode: ContainerMode, furnace?: FurnaceState) {
    this.mode = mode;
    this.furnace = furnace ?? null;
    this.gridSize = mode === "crafting" ? 3 : 2;
    this.grid = new Array(this.gridSize * this.gridSize).fill(null);
    this.result = null;
    this.cursor = null;
    this.build();
    this.isOpen = true;
    this.el.classList.remove("bv-hidden");
    this.unsub = this.host.inventory.onChange(() => this.render());
    this.render();
  }

  /** Returns crafting-grid and cursor items to the inventory; anything left over is dropped. */
  close() {
    if (!this.isOpen) return;
    const inv = this.host.inventory;
    for (const stack of [...this.grid, this.cursor]) {
      if (!stack) continue;
      const left = inv.add(stack.id, stack.count);
      if (left > 0) this.host.dropStack({ id: stack.id, count: left });
    }
    this.grid = [];
    this.cursor = null;
    this.furnace = null;
    this.flameFill = this.arrowFill = this.thumb = null;
    this.isOpen = false;
    this.unsub?.();
    this.unsub = null;
    this.el.classList.add("bv-hidden");
    this.el.replaceChildren();
    this.slotEls.clear();
  }

  private addSlot(ref: SlotRef, x: number, y: number, big = false) {
    const el = h(`div.bv-slot${big ? ".is-big" : ""}` as "div", { style: `left:${px(x)};top:${px(y)}` });
    el.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.click(ref, e.button, e.shiftKey);
    });
    el.addEventListener("mouseenter", () => {
      this.hovered = ref;
      this.updateTooltip();
    });
    el.addEventListener("mouseleave", () => {
      if (this.hovered && refKey(this.hovered) === refKey(ref)) this.hovered = null;
      this.updateTooltip();
    });
    this.panel.append(el);
    this.slotEls.set(refKey(ref), { el, ref });
  }

  private label(text: string, x: number, y: number) {
    this.panel.append(h("div.bv-panel-label", { style: `left:${px(x)};top:${px(y)}` }, text));
  }

  private addInventoryRows(top: number) {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) this.addSlot({ kind: "inv", index: 9 + r * 9 + c }, 7 + c * 18, top + r * 18);
    for (let c = 0; c < 9; c++) this.addSlot({ kind: "inv", index: c }, 7 + c * 18, top + 58);
  }

  private build() {
    this.slotEls.clear();
    const backdrop = h("div.bv-container-backdrop");
    backdrop.addEventListener("mousedown", (e) => {
      // Clicking outside the panel throws the held stack (or one item with right click).
      if (!this.cursor) return;
      if (e.button === 2) {
        this.host.dropStack({ id: this.cursor.id, count: 1 });
        this.cursor.count--;
        if (this.cursor.count <= 0) this.cursor = null;
      } else {
        this.host.dropStack(this.cursor);
        this.cursor = null;
      }
      this.render();
    });
    let height = 166;
    if (this.mode === "creative") height = 16 + PALETTE_ROWS * 18 + 95;
    const width = this.mode === "creative" ? 190 : 176;
    this.panel = h("div.bv-panel", { style: `width:${px(width)};height:${px(height)}` });
    this.panel.addEventListener("mousedown", (e) => e.stopPropagation());

    if (this.mode === "inventory") {
      const portrait = h("div.bv-portrait", { style: `left:${px(25)};top:${px(7)};width:${px(51)};height:${px(72)}` });
      this.panel.append(portrait);
      playerPortrait().attach(portrait);
      for (let i = 0; i < 4; i++) {
        this.addSlot({ kind: "armor", index: i }, 7, 7 + i * 18);
        // Faint outline of what belongs here.
        const el = this.slotEls.get(`armor:${i}`)!.el;
        el.style.backgroundImage = `linear-gradient(rgba(142,138,130,0.78), rgba(142,138,130,0.78)), url(${itemIcon(ARMOR_OUTLINES[i])})`;
        el.style.backgroundSize = `100% 100%, ${px(16)} ${px(16)}`;
        el.style.backgroundPosition = "center";
        el.style.backgroundRepeat = "no-repeat";
      }
      this.label("Crafting", 97, 7);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) this.addSlot({ kind: "grid", index: r * 2 + c }, 97 + c * 18, 17 + r * 18);
      // The 2x2 result uses a regular slot, which fits inside the panel's edge.
      this.panel.append(h("div.bv-arrow", { style: `left:${px(135)};top:${px(29)};width:${px(14)};height:${px(13)}` }));
      this.addSlot({ kind: "out" }, 153, 27);
      this.addInventoryRows(83);
    } else if (this.mode === "crafting") {
      this.label("Crafting", 28, 6);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) this.addSlot({ kind: "grid", index: r * 3 + c }, 29 + c * 18, 16 + r * 18);
      this.panel.append(h("div.bv-arrow", { style: `left:${px(90)};top:${px(35)}` }));
      this.addSlot({ kind: "out" }, 119, 30, true);
      this.label("Inventory", 8, 73);
      this.addInventoryRows(83);
    } else if (this.mode === "furnace") {
      this.label("Furnace", 8, 6);
      this.addSlot({ kind: "furnace", index: 0 }, 55, 16);
      this.addSlot({ kind: "furnace", index: 1 }, 55, 52);
      const flame = h("div.bv-flame", { style: `left:${px(57)};top:${px(36)}` });
      this.flameFill = h("div.bv-flame-fill");
      flame.append(this.flameFill);
      const arrow = h("div.bv-arrow", { style: `left:${px(79)};top:${px(34)}` });
      this.arrowFill = h("div.bv-arrow-fill");
      arrow.append(this.arrowFill);
      this.panel.append(flame, arrow);
      this.addSlot({ kind: "furnace", index: 2 }, 111, 30, true);
      this.label("Inventory", 8, 73);
      this.addInventoryRows(83);
    } else {
      this.label("Creative Inventory", 8, 6);
      for (let i = 0; i < PALETTE_ROWS * 9; i++) this.addSlot({ kind: "pal", index: i }, 7 + (i % 9) * 18, 16 + Math.floor(i / 9) * 18);
      const bar = h("div.bv-scrollbar", { style: `left:${px(172)};top:${px(16)};height:${px(PALETTE_ROWS * 18)}` });
      this.thumb = h("div.bv-scrollbar-thumb");
      bar.append(this.thumb);
      const drag = (e: MouseEvent) => {
        const r = bar.getBoundingClientRect();
        const f = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
        this.scrollTo(Math.round(f * Math.max(0, PALETTE_ROWS_TOTAL - PALETTE_ROWS)));
      };
      bar.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        drag(e);
        const move = (ev: MouseEvent) => drag(ev);
        const up = () => {
          window.removeEventListener("mousemove", move);
          window.removeEventListener("mouseup", up);
        };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", up);
      });
      this.panel.append(bar);
      const invTop = 16 + PALETTE_ROWS * 18 + 15;
      this.label("Inventory", 8, invTop - 10);
      this.addInventoryRows(invTop);
      queueMicrotask(() => this.scrollTo(this.scroll));
    }
    this.el.replaceChildren(backdrop, this.panel, this.cursorEl, this.tooltip);
  }

  private get(ref: SlotRef): ItemStack | null {
    switch (ref.kind) {
      case "inv": return this.host.inventory.slots[ref.index];
      case "grid": return this.grid[ref.index];
      case "out": return this.result;
      case "pal": {
        const id = this.palItem(ref.index);
        return id === null ? null : { id, count: 1 };
      }
      case "armor": return this.host.inventory.armor[ref.index];
      case "furnace": {
        const f = this.furnace;
        if (!f) return null;
        return ref.index === 0 ? f.input : ref.index === 1 ? f.fuel : f.output;
      }
    }
  }

  private set(ref: SlotRef, stack: ItemStack | null) {
    if (stack && stack.count <= 0) stack = null;
    if (ref.kind === "inv") this.host.inventory.slots[ref.index] = stack;
    else if (ref.kind === "grid") this.grid[ref.index] = stack;
    else if (ref.kind === "armor") this.host.inventory.armor[ref.index] = stack;
    else if (ref.kind === "furnace" && this.furnace) {
      if (ref.index === 0) this.furnace.input = stack;
      else if (ref.index === 1) this.furnace.fuel = stack;
      else this.furnace.output = stack;
    }
  }

  /** Can this stack go in this slot? (Furnace fuel only takes fuel; nothing goes into outputs.) */
  private accepts(ref: SlotRef, stack: ItemStack) {
    if (ref.kind === "furnace") return ref.index === 0 || (ref.index === 1 && fuelSeconds(stack.id) > 0);
    return true;
  }

  /** Merges `stack` into one furnace slot; returns what is left over. */
  private mergeInto(ref: SlotRef, stack: ItemStack): number {
    const cur = this.get(ref);
    const max = maxStack(stack.id);
    if (!cur) {
      const n = Math.min(stack.count, max);
      this.set(ref, { id: stack.id, count: n });
      return stack.count - n;
    }
    if (cur.id !== stack.id) return stack.count;
    const n = Math.min(stack.count, max - cur.count);
    cur.count += n;
    return stack.count - n;
  }

  /** Moves a stack into the given inventory slots: merge first, then empty slots. */
  private moveInto(stack: ItemStack, indices: number[]): number {
    const slots = this.host.inventory.slots;
    const max = maxStack(stack.id);
    let left = stack.count;
    for (const i of indices) {
      const s = slots[i];
      if (left > 0 && s && s.id === stack.id && s.count < max) {
        const n = Math.min(left, max - s.count);
        s.count += n;
        left -= n;
      }
    }
    for (const i of indices) {
      if (left > 0 && !slots[i]) {
        const n = Math.min(left, max);
        slots[i] = { id: stack.id, count: n };
        left -= n;
      }
    }
    return left;
  }

  private range(a: number, b: number) {
    return Array.from({ length: b - a }, (_, i) => a + i);
  }

  private quickMove(ref: SlotRef) {
    const s = this.get(ref);
    if (!s) return;
    if (ref.kind === "furnace") {
      const left = this.moveInto({ ...s }, [...this.range(9, INVENTORY_SIZE), ...this.range(0, 9)]);
      if (ref.index === 2 && left < s.count) this.host.onSmeltTake?.(this.furnace!, { id: s.id, count: s.count - left });
      this.set(ref, left > 0 ? { id: s.id, count: left } : null);
      return;
    }
    if (ref.kind === "inv" && this.mode === "furnace") {
      // Shift-click sends smeltables to the input and fuel to the fuel slot.
      const target: SlotRef | null = smeltResult(s.id) !== null ? { kind: "furnace", index: 0 } : fuelSeconds(s.id) > 0 ? { kind: "furnace", index: 1 } : null;
      if (target) {
        const left = this.mergeInto(target, s);
        this.set(ref, left > 0 ? { ...s, count: left } : null);
        return;
      }
    }
    if (ref.kind === "inv" && this.mode === "inventory") {
      // Shift-clicking armor puts it on, if that slot is free.
      const slot = armorSlotOf(s.id);
      if (slot !== undefined && !this.host.inventory.armor[slot]) {
        this.host.inventory.armor[slot] = s;
        this.set(ref, null);
        return;
      }
    }
    if (ref.kind === "armor") {
      const left = this.moveInto({ ...s }, [...this.range(9, INVENTORY_SIZE), ...this.range(0, 9)]);
      this.set(ref, left > 0 ? s : null);
      return;
    }
    if (ref.kind === "inv") {
      const target = ref.index < 9 ? this.range(9, INVENTORY_SIZE) : this.range(0, 9);
      const left = this.moveInto({ ...s }, target);
      this.set(ref, left > 0 ? { id: s.id, count: left } : null);
    } else if (ref.kind === "grid") {
      const left = this.moveInto({ ...s }, [...this.range(9, INVENTORY_SIZE), ...this.range(0, 9)]);
      this.set(ref, left > 0 ? { id: s.id, count: left } : null);
    }
  }

  private consumeGrid() {
    for (let i = 0; i < this.grid.length; i++) {
      const s = this.grid[i];
      if (!s) continue;
      s.count--;
      if (s.count <= 0) this.grid[i] = null;
    }
  }

  private takeResult(shift: boolean) {
    if (!this.result) return;
    if (shift) {
      for (let guard = 0; guard < 64 && this.result; guard++) {
        const r = this.result;
        const order = [...this.range(9, INVENTORY_SIZE), ...this.range(0, 9)];
        // Check it fits completely before consuming the ingredients.
        const snapshot = this.host.inventory.slots.map((s) => (s ? { ...s } : null));
        if (this.moveInto({ ...r }, order) > 0) {
          this.host.inventory.slots = snapshot;
          break;
        }
        this.consumeGrid();
        this.recompute();
        this.host.onCraft(r);
      }
      return;
    }
    const r = this.result;
    if (!this.cursor) this.cursor = { ...r };
    else if (this.cursor.id === r.id && this.cursor.count + r.count <= maxStack(r.id)) this.cursor.count += r.count;
    else return;
    this.consumeGrid();
    this.host.onCraft(r);
  }

  private click(ref: SlotRef, button: number, shift: boolean) {
    this.host.onSlotClick();
    if (ref.kind === "out") {
      this.takeResult(shift);
    } else if (ref.kind === "furnace" && ref.index === 2 && !shift) {
      // The output can only be taken from.
      const out = this.furnace?.output;
      const c = this.cursor;
      if (out && (!c || (c.id === out.id && c.count + out.count <= maxStack(out.id)))) {
        if (c) c.count += out.count;
        else this.cursor = { ...out };
        this.set(ref, null);
        this.host.onSmeltTake?.(this.furnace!, out);
      }
    } else if (ref.kind === "furnace" && this.cursor && !shift && !this.accepts(ref, this.cursor)) {
      // Not fuel: leave the slot alone.
    } else if (ref.kind === "pal") {
      const id = this.palItem(ref.index);
      if (id === null) this.cursor = null;
      else if (this.cursor) this.cursor = null;
      else if (shift) this.moveInto({ id, count: maxStack(id) }, [...this.range(0, 9), ...this.range(9, INVENTORY_SIZE)]);
      else this.cursor = { id, count: button === 2 ? 1 : maxStack(id) };
    } else {
      const s = this.get(ref);
      const c = this.cursor;
      // Armor slots only take the matching piece.
      if (ref.kind === "armor" && c && !shift && armorSlotOf(c.id) !== ref.index) {
        this.host.inventory.changed();
        return;
      }
      if (shift && button === 0) {
        this.quickMove(ref);
      } else if (button === 2) {
        if (!c && s && s.count === 1) {
          this.cursor = s;
          this.set(ref, null);
        } else if (!c && s) {
          const half = Math.ceil(s.count / 2);
          this.cursor = { id: s.id, count: half };
          s.count -= half;
          this.set(ref, s);
        } else if (c && (!s || (s.id === c.id && s.count < maxStack(s.id)))) {
          if (!s) this.set(ref, c.wear ? { id: c.id, count: 1, wear: c.wear } : { id: c.id, count: 1 });
          else s.count++;
          c.count--;
          if (c.count <= 0) this.cursor = null;
        } else if (c && s) {
          this.set(ref, c);
          this.cursor = s;
        }
      } else if (!c) {
        this.cursor = s;
        this.set(ref, null);
      } else if (!s) {
        this.set(ref, c);
        this.cursor = null;
      } else if (s.id === c.id) {
        const n = Math.min(c.count, maxStack(s.id) - s.count);
        s.count += n;
        c.count -= n;
        if (c.count <= 0) this.cursor = null;
      } else {
        this.set(ref, c);
        this.cursor = s;
      }
    }
    this.recompute();
    this.host.inventory.changed();
  }

  private recompute() {
    this.result = this.mode === "creative" ? null : matchRecipe(this.grid, this.gridSize);
  }

  /** Number keys swap the hovered slot with that hotbar slot; Q throws one item. */
  handleKey(code: string) {
    const ref = this.hovered;
    if (!ref) return;
    if (code.startsWith("Digit")) {
      const n = Number(code.slice(5)) - 1;
      if (n < 0 || n > 8) return;
      if (ref.kind === "inv" || ref.kind === "grid") {
        const a = this.get(ref);
        const b = this.host.inventory.slots[n];
        this.host.inventory.slots[n] = a;
        this.set(ref, b);
      } else if (ref.kind === "pal") {
        const id = this.palItem(ref.index);
        if (id !== null) this.host.inventory.slots[n] = { id, count: maxStack(id) };
      }
      this.recompute();
      this.host.inventory.changed();
    } else if (code === "KeyQ" && (ref.kind === "inv" || ref.kind === "grid")) {
      const s = this.get(ref);
      if (!s) return;
      this.host.dropStack({ id: s.id, count: 1 });
      s.count--;
      this.set(ref, s);
      this.recompute();
      this.host.inventory.changed();
    }
  }

  /** Called every frame: the furnace keeps cooking while its screen is open. */
  tick() {
    if (!this.isOpen || this.mode !== "furnace" || !this.furnace) return;
    const f = this.furnace;
    if (this.flameFill) this.flameFill.style.height = `${f.burnTotal > 0 ? Math.ceil((f.burnLeft / f.burnTotal) * 14) / 14 * 100 : 0}%`;
    if (this.arrowFill) this.arrowFill.style.width = `${Math.floor((f.cook / SMELT_SECONDS) * 22) / 22 * 100}%`;
    for (const { el, ref } of this.slotEls.values()) if (ref.kind === "furnace") renderStack(el, this.get(ref));
  }

  private render() {
    if (!this.isOpen) return;
    for (const { el, ref } of this.slotEls.values()) renderStack(el, this.get(ref));
    renderStack(this.cursorEl, this.cursor);
    this.updateTooltip();
  }

  private updateTooltip() {
    const s = this.hovered ? this.get(this.hovered) : null;
    if (!s || this.cursor) {
      this.tooltip.classList.add("bv-hidden");
      return;
    }
    const item = getItem(s.id);
    this.tooltip.replaceChildren(item?.name ?? "?");
    if (item?.tool) this.tooltip.append(h("small", {}, `${item.tool.type} · speed ×${item.tool.speed}`));
    this.tooltip.classList.remove("bv-hidden");
    this.positionTooltip();
  }

  private positionTooltip() {
    this.tooltip.style.left = `${this.mouse.x + 14}px`;
    this.tooltip.style.top = `${this.mouse.y - 22}px`;
  }
}

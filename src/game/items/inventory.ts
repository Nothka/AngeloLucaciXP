import { getItem } from "../world/blocks";

export interface ItemStack {
  id: number;
  count: number;
  /** Uses spent, for items with durability. */
  wear?: number;
}

export type SavedStack = [number, number] | [number, number, number] | null;

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36;

export const maxStack = (id: number) => getItem(id)?.maxStack ?? 64;

/** 36 slots: 0..8 hotbar, 9..35 main inventory. */
export class Inventory {
  slots: (ItemStack | null)[] = new Array(INVENTORY_SIZE).fill(null);
  /** Worn armor: head, chest, legs, feet. */
  armor: (ItemStack | null)[] = [null, null, null, null];
  selected = 0;
  private listeners = new Set<() => void>();

  onChange(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  changed() {
    for (const fn of this.listeners) fn();
  }

  get held(): ItemStack | null {
    return this.slots[this.selected];
  }

  /** Adds items, merging into existing stacks first. Returns how many did not fit. */
  add(id: number, count: number, wear?: number): number {
    const max = maxStack(id);
    if (wear && max === 1) {
      const free = this.slots.findIndex((s) => !s);
      if (free < 0) return count;
      this.slots[free] = { id, count: 1, wear };
      this.changed();
      return count - 1;
    }
    let left = count;
    for (let i = 0; i < INVENTORY_SIZE && left > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < max) {
        const n = Math.min(left, max - s.count);
        s.count += n;
        left -= n;
      }
    }
    for (let i = 0; i < INVENTORY_SIZE && left > 0; i++) {
      if (!this.slots[i]) {
        const n = Math.min(left, max);
        this.slots[i] = { id, count: n };
        left -= n;
      }
    }
    if (left !== count) this.changed();
    return left;
  }

  removeFromSlot(slot: number, n = 1): ItemStack | null {
    const s = this.slots[slot];
    if (!s) return null;
    const taken = Math.min(n, s.count);
    s.count -= taken;
    if (s.count <= 0) this.slots[slot] = null;
    this.changed();
    return s.wear ? { id: s.id, count: taken, wear: s.wear } : { id: s.id, count: taken };
  }

  get armorPoints() {
    return this.armor.reduce((sum, s) => sum + (s ? getItem(s.id)?.armor?.points ?? 0 : 0), 0);
  }

  /** Count of an item across all slots. */
  countOf(id: number) {
    return this.slots.reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0);
  }

  /** Removes `n` of an item from wherever it is; returns how many were removed. */
  take(id: number, n: number) {
    let left = n;
    for (let i = 0; i < this.slots.length && left > 0; i++) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(left, s.count);
      s.count -= k;
      left -= k;
      if (s.count <= 0) this.slots[i] = null;
    }
    if (left !== n) this.changed();
    return n - left;
  }

  serializeArmor(): SavedStack[] {
    return this.armor.map((s) => (s ? (s.wear ? [s.id, s.count, s.wear] : [s.id, s.count]) : null));
  }

  loadArmor(data: SavedStack[] | undefined) {
    this.armor = [null, null, null, null];
    data?.forEach((entry, i) => {
      if (entry && i < 4 && getItem(entry[0])?.armor) this.armor[i] = entry[2] ? { id: entry[0], count: 1, wear: entry[2] } : { id: entry[0], count: 1 };
    });
  }

  serialize(): SavedStack[] {
    return this.slots.map((s) => (s ? (s.wear ? [s.id, s.count, s.wear] : [s.id, s.count]) : null));
  }

  load(data: SavedStack[] | undefined, selected = 0) {
    this.slots = new Array(INVENTORY_SIZE).fill(null);
    data?.forEach((entry, i) => {
      if (entry && i < INVENTORY_SIZE && getItem(entry[0])) {
        this.slots[i] = entry[2] ? { id: entry[0], count: entry[1], wear: entry[2] } : { id: entry[0], count: entry[1] };
      }
    });
    this.selected = Math.max(0, Math.min(HOTBAR_SIZE - 1, selected));
    this.changed();
  }
}

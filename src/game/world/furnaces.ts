import type { ItemStack } from "../items/inventory";
import { maxStack } from "../items/inventory";
import { SMELT_SECONDS, fuelSeconds, smeltResult } from "../items/smelting";
import { B } from "./blocks";

export interface FurnaceState {
  input: ItemStack | null;
  fuel: ItemStack | null;
  output: ItemStack | null;
  /** Seconds of fire left, and how long the current fuel item lasts in total. */
  burnLeft: number;
  burnTotal: number;
  /** Seconds the current item has been cooking. */
  cook: number;
  /** Experience banked from smelting, paid out when the output is taken. */
  xp: number;
}

export const emptyFurnace = (): FurnaceState => ({ input: null, fuel: null, output: null, burnLeft: 0, burnTotal: 0, cook: 0, xp: 0 });

/** Can the furnace's current input be smelted into its output slot? */
function canSmelt(f: FurnaceState): number | null {
  if (!f.input) return null;
  const out = smeltResult(f.input.id);
  if (out === null) return null;
  if (f.output && (f.output.id !== out || f.output.count >= maxStack(out))) return null;
  return out;
}

/**
 * Advances one furnace by `dt` seconds (pure: mutates and returns the
 * state). Fuel is only lit when there is something to smelt; the fire keeps
 * burning out its current fuel item either way.
 */
export function tickFurnace(f: FurnaceState, dt: number, xpPerItem: (out: number) => number = () => 0): FurnaceState {
  const result = canSmelt(f);
  if (f.burnLeft <= 0 && result !== null && f.fuel && fuelSeconds(f.fuel.id) > 0) {
    f.burnTotal = f.burnLeft = fuelSeconds(f.fuel.id);
    f.fuel.count--;
    if (f.fuel.count <= 0) f.fuel = null;
  }
  if (f.burnLeft > 0) {
    f.burnLeft = Math.max(0, f.burnLeft - dt);
    if (result !== null) {
      f.cook += dt;
      if (f.cook >= SMELT_SECONDS) {
        f.cook = 0;
        f.input!.count--;
        if (f.input!.count <= 0) f.input = null;
        if (f.output) f.output.count++;
        else f.output = { id: result, count: 1 };
        f.xp += xpPerItem(result);
      }
    } else {
      f.cook = 0;
    }
  } else {
    // Without fire, half-cooked items slowly cool back down.
    f.cook = Math.max(0, f.cook - dt * 2);
  }
  return f;
}

export const isLit = (f: FurnaceState) => f.burnLeft > 0;

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;

/** Every furnace in the world, keyed by position; saved with the world's metadata. */
export class FurnaceRegistry {
  private map = new Map<string, FurnaceState>();

  constructor(saved: Record<string, FurnaceState> | undefined, private setLit: (x: number, y: number, z: number, lit: boolean) => void) {
    for (const [k, v] of Object.entries(saved ?? {})) this.map.set(k, v);
  }

  get(x: number, y: number, z: number): FurnaceState {
    const k = key(x, y, z);
    let f = this.map.get(k);
    if (!f) this.map.set(k, (f = emptyFurnace()));
    return f;
  }

  /** Removes a broken furnace and returns what was inside it. */
  remove(x: number, y: number, z: number): ItemStack[] {
    const k = key(x, y, z);
    const f = this.map.get(k);
    this.map.delete(k);
    return f ? [f.input, f.fuel, f.output].filter((s): s is ItemStack => !!s) : [];
  }

  /** Runs all furnaces whose block is present; `blockAt` returns the block there (or null if unloaded). */
  tick(dt: number, blockAt: (x: number, y: number, z: number) => number | null, xpPerItem: (out: number) => number) {
    for (const [k, f] of this.map) {
      const [x, y, z] = k.split(",").map(Number);
      const id = blockAt(x, y, z);
      if (id === null) continue;
      if (id !== B.FURNACE && id !== B.FURNACE_LIT) {
        this.map.delete(k);
        continue;
      }
      const was = isLit(f);
      tickFurnace(f, dt, xpPerItem);
      if (isLit(f) !== was || (id === B.FURNACE_LIT) !== isLit(f)) this.setLit(x, y, z, isLit(f));
    }
  }

  serialize(): Record<string, FurnaceState> {
    const out: Record<string, FurnaceState> = {};
    for (const [k, f] of this.map) {
      if (f.input || f.fuel || f.output || f.burnLeft > 0) out[k] = f;
    }
    return out;
  }
}

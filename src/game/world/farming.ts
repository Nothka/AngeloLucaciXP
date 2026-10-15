import { B, isWater } from "./blocks";

/**
 * Farming rules: farmland turns moist when there is water within 4 blocks
 * of it (level with it or one above), and wheat only grows on moist
 * farmland. Dry farmland looks lighter and grows nothing.
 */

export interface FarmWorld {
  getBlock(x: number, y: number, z: number): number;
}

/** Blocks around farmland that water can be in to keep it moist. */
export const WATER_REACH = 4;

export const isFarmland = (id: number) => id === B.FARMLAND || id === B.FARMLAND_WET;

/** Is there water within reach of the farmland at (x, y, z)? */
export function isHydrated(w: FarmWorld, x: number, y: number, z: number): boolean {
  for (let dy = 0; dy <= 1; dy++) {
    for (let dz = -WATER_REACH; dz <= WATER_REACH; dz++) {
      for (let dx = -WATER_REACH; dx <= WATER_REACH; dx++) {
        if (isWater(w.getBlock(x + dx, y + dy, z + dz))) return true;
      }
    }
  }
  return false;
}

/** The farmland block this cell should be right now: moist near water, dry otherwise. */
export const farmlandFor = (w: FarmWorld, x: number, y: number, z: number) => (isHydrated(w, x, y, z) ? B.FARMLAND_WET : B.FARMLAND);

/** Chance per second that a crop grows a stage (only on moist farmland, with enough light). */
export function growthChance(soil: number, light: number): number {
  if (soil !== B.FARMLAND_WET || light < 9) return 0;
  return 1 / 25;
}

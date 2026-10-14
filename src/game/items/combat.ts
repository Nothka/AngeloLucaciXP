import { getItem } from "../world/blocks";

/** Anything that can be hit: mobs, other players, training dummies — none exist yet. */
export interface Attackable {
  readonly name: string;
  hurt(amount: number, source: { weapon: number; from?: { x: number; z: number } }): void;
}

export const FIST_DAMAGE = 1;

/** Melee damage in half-hearts for the item in hand (empty hand = 1). */
export function attackDamage(itemId: number): number {
  return getItem(itemId)?.damage ?? FIST_DAMAGE;
}

/** Durability spent per use: swords are built for hitting, tools for digging. */
export function wearFor(itemId: number, use: "block" | "attack"): number {
  const tool = getItem(itemId)?.tool;
  if (!tool) return 0;
  if (tool.type === "sword") return use === "block" ? 2 : 1;
  return use === "block" ? 1 : 2;
}

/** Armor soaks up to 80% of combat damage: each point is 4%, capped at 20 points. */
export function armorReduction(amount: number, armorPoints: number): number {
  return amount * (1 - Math.min(20, Math.max(0, armorPoints)) / 25);
}

/** Bow power 0..1 from seconds held, easing in like a real draw (full at 1 s). */
export function bowPower(drawSeconds: number): number {
  const t = Math.max(0, drawSeconds);
  return Math.min(1, (t * t + 2 * t) / 3);
}

/** Arrow damage for a shot of the given power (half-hearts): 1 at a tap, 9 at full draw. */
export const arrowDamage = (power: number) => Math.max(1, Math.ceil(power * 9));

/** Fall damage in half-hearts: free up to 3.5 blocks, then 0.7 per block. */
export function fallDamage(blocks: number): number {
  return blocks > 3.5 ? Math.ceil((blocks - 3.5) * 0.7) : 0;
}

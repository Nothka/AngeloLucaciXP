/**
 * Small, pure rules for animal life, all in seconds except where noted:
 * idle sounds, feeding, falling in love, breeding and egg laying.
 */

/** Game ticks per second; the idle-sound dice are rolled once per tick. */
export const TICK = 1 / 20;
/** Ticks of quiet after every idle or hurt sound. */
export const AMBIENT_QUIET_TICKS = 140;

/**
 * One tick of the idle-sound timer. Each tick the counter goes up by one and
 * a 1-in-1000 dice must roll under it, so after the 7 s of quiet the chance
 * keeps rising until the mob speaks: on average every ~9 s, rarely beyond 13.
 */
export function ambientTick(counter: number, rand: () => number): { counter: number; play: boolean } {
  if (Math.floor(rand() * 1000) < counter) return { counter: -AMBIENT_QUIET_TICKS, play: true };
  return { counter: counter + 1, play: false };
}

/** A fresh counter, part-way through the quiet period so a herd does not speak in unison. */
export const freshAmbientCounter = (rand: () => number) => -Math.floor(rand() * AMBIENT_QUIET_TICKS);

export const LOVE_SECONDS = 30;
export const BREED_COOLDOWN_SECONDS = 300;
/** How close two animals in love must stay, and for how long, to have a baby. */
export const BREED_DISTANCE = 2.5;
export const BREED_SECONDS = 3;
/** How far an animal in love looks for a partner, and follows someone holding its food. */
export const PARTNER_RANGE = 8;
export const TEMPT_RANGE = 10;
/** Chickens lay an egg every 5 to 10 minutes. */
export const EGG_MIN_SECONDS = 300;
export const EGG_MAX_SECONDS = 600;

/** Per-tick chance that a sheep stops to eat grass (babies are always hungry). */
export const grazeChance = (baby: boolean) => (baby ? 1 / 50 : 1 / 1000);
/** Blocks walked between footstep sounds (smaller animals take shorter steps). */
export const stepLength = (width: number) => Math.max(0.5, Math.min(1.2, width + 0.3));

export const nextEggDelay = (rand: () => number) => EGG_MIN_SECONDS + rand() * (EGG_MAX_SECONDS - EGG_MIN_SECONDS);

export interface Feedable {
  baby: boolean;
  /** Seconds lived (babies grow up at `growUpSeconds`). */
  age: number;
  love: number;
  breedCooldown: number;
}

export type FeedResult = "love" | "grow" | "refused";

/**
 * Hand an animal its breeding food. Adults that are ready fall in love;
 * babies grow up 10% of the way faster; anyone else ignores it (and the
 * item is not used up).
 */
export function feed(a: Feedable, growUpSeconds: number): FeedResult {
  if (a.baby) {
    a.age += (growUpSeconds - a.age) * 0.1;
    return "grow";
  }
  if (a.love > 0 || a.breedCooldown > 0) return "refused";
  a.love = LOVE_SECONDS;
  return "love";
}

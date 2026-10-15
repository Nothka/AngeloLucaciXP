import { BLOCKS, B, IS_SOLID, isWater } from "./blocks";

/**
 * Weather cycle: long clear spells broken by rain, and some rain turning
 * into thunderstorms. `rain` and `thunder` ease toward their targets so the
 * sky darkens and clears gradually.
 */
export type WeatherKind = "clear" | "rain" | "thunder";

export interface WeatherSave {
  kind: WeatherKind;
  /** Seconds until the weather changes by itself. */
  left: number;
}

const between = (rand: () => number, lo: number, hi: number) => lo + rand() * (hi - lo);

export class Weather {
  kind: WeatherKind = "clear";
  left: number;
  /** Eased 0..1 strengths for rendering, sound and light. */
  rain = 0;
  thunder = 0;
  /** 0..1 brightness of the latest lightning flash. */
  flash = 0;
  private nextBolt = 10;

  constructor(saved: WeatherSave | undefined, private rand: () => number = Math.random) {
    this.left = between(rand, 600, 1800);
    if (saved) {
      this.kind = saved.kind;
      this.left = saved.left;
      this.rain = saved.kind === "clear" ? 0 : 1;
      this.thunder = saved.kind === "thunder" ? 1 : 0;
    }
  }

  get raining() {
    return this.kind !== "clear";
  }

  /** Sets the weather, for `duration` seconds or a natural length. */
  set(kind: WeatherKind, duration?: number) {
    this.kind = kind;
    this.left = duration ?? (kind === "clear" ? between(this.rand, 600, 1800) : between(this.rand, 240, 600));
    this.nextBolt = between(this.rand, 2, 8);
  }

  /** Advances by `dt` seconds; returns true when a lightning bolt strikes this frame. */
  update(dt: number): boolean {
    this.left -= dt;
    if (this.left <= 0) {
      if (this.kind === "clear") this.set(this.rand() < 0.3 ? "thunder" : "rain");
      else this.set("clear");
    }
    const ease = 1 - Math.exp(-dt / 4);
    this.rain += ((this.raining ? 1 : 0) - this.rain) * ease;
    this.thunder += ((this.kind === "thunder" ? 1 : 0) - this.thunder) * ease;
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.kind !== "thunder" || this.thunder < 0.5) return false;
    this.nextBolt -= dt;
    if (this.nextBolt > 0) return false;
    this.nextBolt = between(this.rand, 6, 22);
    this.flash = 1;
    return true;
  }

  /** How much rain and storms dim the sky (0..1), for light, fog and mob spawning. */
  get gloom() {
    return this.rain * 0.55 + this.thunder * 0.3;
  }

  serialize(): WeatherSave {
    return { kind: this.kind, left: Math.max(1, Math.round(this.left)) };
  }
}

/** Blocks within which falling rain can be heard, as with other world sounds. */
export const RAIN_HEARING = 16;

const loudness = (dx: number, dz: number, dy: number) => Math.max(0, 1 - Math.hypot(dx, dz, dy) / RAIN_HEARING);

/** Average loudness over the sampled columns for someone standing on open, flat ground: full volume. */
function openGround(radius: number, step: number) {
  let sum = 0, n = 0;
  for (let dz = -radius; dz <= radius; dz += step) for (let dx = -radius; dx <= radius; dx += step) {
    sum += loudness(dx, dz, -1.6);
    n++;
  }
  return sum / n;
}

/**
 * How loud the rain is for someone at `eye`. Like the classic game, rain is
 * heard from where it lands on the columns around them (`landsAt` gives the
 * height it stops at): each column contributes by its distance, averaged,
 * so open ground is full volume. Underground the rain lands on the surface
 * far above, so it fades as you dig down and is gone about 16 blocks under;
 * a single open shaft above you barely counts. `covered` is how muffled it is
 * by a roof overhead.
 */
export function rainHearing(
  eye: { x: number; y: number; z: number },
  landsAt: (x: number, z: number) => number,
  radius = 10,
  step = 2,
): { volume: number; covered: number } {
  const ex = Math.floor(eye.x), ez = Math.floor(eye.z);
  let sum = 0, n = 0, above = 0;
  for (let dz = -radius; dz <= radius; dz += step) {
    for (let dx = -radius; dx <= radius; dx += step) {
      const top = landsAt(ex + dx, ez + dz);
      const v = loudness(dx, dz, top - eye.y);
      sum += v;
      above += v * Math.max(0, top - eye.y);
      n++;
    }
  }
  const volume = Math.min(1, sum / n / openGround(radius, step));
  const roof = landsAt(ex, ez) > eye.y + 1;
  // Through a roof, rain landing above you sounds dull, like the classic "rain above" sound.
  const height = sum > 0 ? above / sum : 0;
  const covered = roof ? Math.min(1, Math.max(0.4, height / 6)) : 0;
  return { volume, covered };
}

/** Height rain lands at in a column: on top of the first block from the sky that stops it (leaves and glass do; plants and torches don't). */
export function rainLandsAt(world: { getBlock(x: number, y: number, z: number): number }, x: number, z: number, top = 127): number {
  for (let y = top; y > 0; y--) {
    const id = world.getBlock(x, y, z);
    if (id !== B.AIR && (IS_SOLID[id] || isWater(id) || (BLOCKS[id]?.pass === "cutout" && BLOCKS[id]?.shape === "cube"))) return y + 1;
  }
  return 0;
}

/**
 * Snow or rain for someone standing at (x, z): one answer for all the
 * weather around them, from the ground nearby (nine points within 4 blocks),
 * so the edge of a cold biome never shows snow on one block and rain on the
 * next. Returns the share of those points that are cold (0..1); 0.5 or more
 * means it snows here.
 */
export function snowShareAround(x: number, z: number, isCold: (x: number, z: number) => boolean, reach = 4): number {
  let cold = 0;
  for (const dz of [-reach, 0, reach]) for (const dx of [-reach, 0, reach]) if (isCold(Math.floor(x) + dx, Math.floor(z) + dz)) cold++;
  return cold / 9;
}

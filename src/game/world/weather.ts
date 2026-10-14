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

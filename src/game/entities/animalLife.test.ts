import { describe, expect, it } from "vitest";
import { AMBIENT_QUIET_TICKS, TICK, ambientTick, feed, freshAmbientCounter, grazeChance, nextEggDelay, stepLength } from "./animalLife";
import { mobPitch } from "../audio/audio";
import { mulberry32 } from "../noise";

describe("idle sounds", () => {
  it("are quiet for 7 seconds after speaking, then random", () => {
    const rand = mulberry32(7);
    let c = -AMBIENT_QUIET_TICKS;
    for (let i = 0; i < AMBIENT_QUIET_TICKS; i++) {
      const r = ambientTick(c, rand);
      expect(r.play).toBe(false);
      c = r.counter;
    }
  });

  it("average one every 7 to 12 seconds per animal", () => {
    const rand = mulberry32(42);
    let c = 0, ticks = 0, sounds = 0;
    const gaps: number[] = [];
    let last = 0;
    for (; ticks < 20 * 60 * 60; ticks++) {
      const r = ambientTick(c, rand);
      c = r.counter;
      if (r.play) {
        sounds++;
        gaps.push((ticks - last) * TICK);
        last = ticks;
      }
    }
    const mean = (ticks * TICK) / sounds;
    expect(mean).toBeGreaterThan(7);
    expect(mean).toBeLessThan(12);
    expect(Math.min(...gaps.slice(1))).toBeGreaterThanOrEqual(7);
  });

  it("start herds out of step", () => {
    const rand = mulberry32(3);
    const starts = new Set(Array.from({ length: 20 }, () => freshAmbientCounter(rand)));
    expect(starts.size).toBeGreaterThan(10);
  });
});

describe("feeding and breeding", () => {
  it("adults fall in love once, then must wait", () => {
    const cow = { baby: false, age: 2000, love: 0, breedCooldown: 0 };
    expect(feed(cow, 1200)).toBe("love");
    expect(cow.love).toBe(30);
    expect(feed(cow, 1200)).toBe("refused");
    cow.love = 0;
    cow.breedCooldown = 120;
    expect(feed(cow, 1200)).toBe("refused");
  });

  it("babies grow up faster when fed", () => {
    const calf = { baby: true, age: 0, love: 0, breedCooldown: 0 };
    expect(feed(calf, 1200)).toBe("grow");
    expect(calf.age).toBeCloseTo(120);
    expect(calf.love).toBe(0);
  });

  it("eggs come every 5 to 10 minutes", () => {
    expect(nextEggDelay(() => 0)).toBe(300);
    expect(nextEggDelay(() => 0.999)).toBeLessThan(600);
  });
});

describe("sound details from the classic tables", () => {
  it("pitches adult voices 0.8-1.2 and babies 1.3-1.7", () => {
    expect(mobPitch(false, () => 0)).toBeCloseTo(0.8);
    expect(mobPitch(false, () => 0.999)).toBeLessThan(1.2);
    expect(mobPitch(true, () => 0)).toBeCloseTo(1.3);
    expect(mobPitch(true, () => 0.999)).toBeLessThan(1.7);
  });

  it("lambs graze far more often than adult sheep", () => {
    expect(grazeChance(false)).toBe(1 / 1000);
    expect(grazeChance(true)).toBe(1 / 50);
  });

  it("small animals take shorter steps", () => {
    expect(stepLength(0.45)).toBeLessThan(stepLength(0.9));
    expect(stepLength(0.1)).toBe(0.5);
    expect(stepLength(3)).toBe(1.2);
  });
});

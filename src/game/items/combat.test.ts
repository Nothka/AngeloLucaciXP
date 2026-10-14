import { describe, expect, it } from "vitest";
import { armorReduction, arrowDamage, bowPower, fallDamage } from "./combat";
import { levelFromPoints, pointsForNextLevel } from "../player/experience";
import { matchRecipe } from "./crafting";
import { I } from "../world/blocks";

describe("fallDamage", () => {
  it("is free up to 3.5 blocks and gentler than one per block after", () => {
    expect(fallDamage(3)).toBe(0);
    expect(fallDamage(3.5)).toBe(0);
    expect(fallDamage(4)).toBe(1);
    expect(fallDamage(8)).toBe(4);
    expect(fallDamage(12)).toBe(6);
    for (let b = 4; b < 40; b++) expect(fallDamage(b)).toBeLessThanOrEqual(Math.ceil(b - 3));
    for (let b = 6; b < 40; b++) expect(fallDamage(b)).toBeLessThan(Math.ceil(b - 3));
  });
});

describe("armorReduction", () => {
  it("removes 4% per point, capped at 80%", () => {
    expect(armorReduction(10, 0)).toBe(10);
    expect(armorReduction(10, 15)).toBeCloseTo(4);
    expect(armorReduction(10, 20)).toBeCloseTo(2);
    expect(armorReduction(10, 30)).toBeCloseTo(2);
  });
});

describe("bow", () => {
  it("reaches full power after a one-second draw", () => {
    expect(bowPower(0)).toBe(0);
    expect(bowPower(0.5)).toBeCloseTo(0.4167, 3);
    expect(bowPower(1)).toBe(1);
    expect(bowPower(3)).toBe(1);
    expect(arrowDamage(1)).toBe(9);
    expect(arrowDamage(0.05)).toBe(1);
  });
  it("crafts from three sticks and three strings, either way round", () => {
    const S = { id: I.STICK, count: 1 };
    const X = { id: I.STRING, count: 1 };
    expect(matchRecipe([null, S, X, S, null, X, null, S, X], 3)?.id).toBe(I.BOW);
    expect(matchRecipe([X, S, null, X, null, S, X, S, null], 3)?.id).toBe(I.BOW);
  });
});

describe("experience levels", () => {
  it("follows the classic curve", () => {
    expect(pointsForNextLevel(0)).toBe(7);
    expect(pointsForNextLevel(15)).toBe(37);
    expect(pointsForNextLevel(30)).toBe(112);
    expect(levelFromPoints(0)).toEqual({ level: 0, progress: 0 });
    expect(levelFromPoints(7).level).toBe(1);
    expect(levelFromPoints(16).level).toBe(2);
    expect(levelFromPoints(352).level).toBe(16);
    expect(levelFromPoints(10).progress).toBeCloseTo(3 / 9);
  });
});

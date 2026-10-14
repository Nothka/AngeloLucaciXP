import { describe, expect, it } from "vitest";
import { B, I } from "./blocks";
import { FurnaceRegistry, emptyFurnace, isLit, tickFurnace } from "./furnaces";
import { SMELT_SECONDS, fuelSeconds, smeltResult } from "../items/smelting";

const run = (f: ReturnType<typeof emptyFurnace>, seconds: number, xp?: (id: number) => number) => {
  for (let t = 0; t < seconds; t += 0.1) tickFurnace(f, 0.1, xp);
  return f;
};

describe("smelting table", () => {
  it("turns ores, sand, clay and food into their results", () => {
    expect(smeltResult(B.IRON_ORE)).toBe(I.IRON_INGOT);
    expect(smeltResult(B.GOLD_ORE)).toBe(I.GOLD_INGOT);
    expect(smeltResult(B.SAND)).toBe(B.GLASS);
    expect(smeltResult(B.COBBLESTONE)).toBe(B.STONE);
    expect(smeltResult(I.CLAY_BALL)).toBe(I.BRICK);
    expect(smeltResult(I.RAW_MEAT)).toBe(I.STEAK);
    expect(smeltResult(I.RAW_FISH)).toBe(I.COOKED_FISH);
    expect(smeltResult(B.DIRT)).toBeNull();
  });

  it("knows its fuels", () => {
    expect(fuelSeconds(I.COAL)).toBe(80);
    expect(fuelSeconds(B.PLANKS)).toBe(15);
    expect(fuelSeconds(I.STICK)).toBe(5);
    expect(fuelSeconds(B.STONE)).toBe(0);
  });
});

describe("furnace", () => {
  it("smelts one item every 10 seconds while fuel lasts", () => {
    const f = emptyFurnace();
    f.input = { id: B.IRON_ORE, count: 3 };
    f.fuel = { id: B.PLANKS, count: 1 }; // 15 s: one and a half items
    run(f, SMELT_SECONDS + 0.05, () => 0.7);
    expect(f.output).toEqual({ id: I.IRON_INGOT, count: 1 });
    expect(f.fuel).toBeNull();
    expect(isLit(f)).toBe(true);
    run(f, 20);
    // The plank burnt out half way through the second ore.
    expect(f.output?.count).toBe(1);
    expect(f.input?.count).toBe(2);
    expect(isLit(f)).toBe(false);
    expect(f.xp).toBeCloseTo(0.7);
  });

  it("does not light without something to smelt", () => {
    const f = emptyFurnace();
    f.fuel = { id: I.COAL, count: 2 };
    run(f, 5);
    expect(f.fuel?.count).toBe(2);
    expect(isLit(f)).toBe(false);
  });

  it("stops when the output slot is full of something else", () => {
    const f = emptyFurnace();
    f.input = { id: B.SAND, count: 1 };
    f.fuel = { id: I.COAL, count: 1 };
    f.output = { id: B.STONE, count: 1 };
    run(f, 12);
    expect(f.input?.count).toBe(1);
    expect(f.fuel?.count).toBe(1);
  });

  it("registry swaps lit and unlit blocks and drops contents", () => {
    const lit: boolean[] = [];
    const reg = new FurnaceRegistry(undefined, (_x, _y, _z, on) => lit.push(on));
    const f = reg.get(1, 2, 3);
    f.input = { id: B.SAND, count: 1 };
    f.fuel = { id: I.STICK, count: 1 };
    reg.tick(0.1, () => B.FURNACE, () => 0);
    expect(lit).toEqual([true]);
    expect(Object.keys(reg.serialize())).toEqual(["1,2,3"]);
    expect(reg.remove(1, 2, 3)).toEqual([{ id: B.SAND, count: 1 }]);
  });
});

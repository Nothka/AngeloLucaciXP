import { describe, expect, it } from "vitest";
import { Weather, rainHearing, snowShareAround } from "./weather";

describe("weather", () => {
  it("eases rain in and out", () => {
    const w = new Weather(undefined, () => 0.5);
    w.set("rain", 100);
    for (let i = 0; i < 200; i++) w.update(0.1);
    expect(w.rain).toBeGreaterThan(0.95);
    w.set("clear", 100);
    for (let i = 0; i < 200; i++) w.update(0.1);
    expect(w.rain).toBeLessThan(0.05);
  });

  it("changes by itself when its time runs out", () => {
    const w = new Weather({ kind: "clear", left: 1 }, () => 0.9);
    w.update(2);
    expect(w.kind).toBe("rain");
    expect(w.serialize().kind).toBe("rain");
  });

  it("strikes lightning only in storms", () => {
    const w = new Weather({ kind: "thunder", left: 1000 }, () => 0.5);
    let bolts = 0;
    for (let i = 0; i < 600; i++) if (w.update(0.1)) bolts++;
    expect(bolts).toBeGreaterThan(1);
    w.set("rain", 1000);
    bolts = 0;
    for (let i = 0; i < 600; i++) if (w.update(0.1)) bolts++;
    expect(bolts).toBe(0);
  });
});

describe("hearing the rain", () => {
  const flat = (h: number) => () => h;

  it("is full strength out in the open", () => {
    const r = rainHearing({ x: 0.5, y: 65.6, z: 0.5 }, flat(64));
    expect(r.volume).toBeGreaterThan(0.85);
    expect(r.covered).toBe(0);
  });

  it("fades as you dig straight down, and is gone 16 blocks under", () => {
    // A 1x1 shaft at x = z = 0: open down to the shaft floor, solid ground at 64 elsewhere.
    const shaft = (floor: number) => (x: number, z: number) => (x === 0 && z === 0 ? floor : 64);
    const at = (depth: number) => rainHearing({ x: 0.5, y: 64 - depth + 1.6, z: 0.5 }, shaft(64 - depth)).volume;
    expect(at(4)).toBeLessThan(at(0));
    expect(at(10)).toBeLessThan(at(4));
    expect(at(18)).toBeLessThan(at(10));
    expect(rainHearing({ x: 0.5, y: 30, z: 0.5 }, flat(64)).volume).toBe(0);
  });

  it("is muffled under a roof", () => {
    const roofed = (x: number, z: number) => (Math.abs(x) <= 2 && Math.abs(z) <= 2 ? 70 : 64);
    const r = rainHearing({ x: 0.5, y: 65.6, z: 0.5 }, roofed);
    expect(r.volume).toBeGreaterThan(0.5);
    expect(r.covered).toBeGreaterThan(0);
  });
});

describe("snow or rain where you stand", () => {
  // Cold for x < 0, warm from x = 0 on: a sharp biome edge.
  const coldWest = (x: number) => x < 0;

  it("gives one answer for the whole spot, not per block", () => {
    expect(snowShareAround(-10, 0, coldWest)).toBe(1);
    expect(snowShareAround(10, 0, coldWest)).toBe(0);
  });

  it("goes with most of the ground around you at the edge", () => {
    // One block into the warm side: two of the three sample rows are still cold.
    expect(snowShareAround(1, 0, coldWest)).toBeCloseTo(1 / 3);
    expect(snowShareAround(-1, 0, coldWest)).toBeCloseTo(2 / 3);
  });
});

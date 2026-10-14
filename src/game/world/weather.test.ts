import { describe, expect, it } from "vitest";
import { Weather } from "./weather";

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

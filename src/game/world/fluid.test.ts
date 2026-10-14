import { describe, expect, it } from "vitest";
import { B, FLUID_LEVEL, waterHeight16 } from "./blocks";
import { FluidSimulator, flowDirections, nextFluidState, type FluidWorld } from "./fluid";

/** Tiny in-memory world: everything at y <= 0 is dirt, everything else air unless set. */
class GridWorld implements FluidWorld {
  cells = new Map<string, number>();
  getBlock(x: number, y: number, z: number) {
    const v = this.cells.get(`${x},${y},${z}`);
    if (v !== undefined) return v;
    return y <= 0 ? B.DIRT : B.AIR;
  }
  setBlock(x: number, y: number, z: number, id: number) {
    this.cells.set(`${x},${y},${z}`, id);
    return true;
  }
  isLoaded() {
    return true;
  }
}

function settle(sim: FluidSimulator, max = 300) {
  let ticks = 0;
  while (sim.pending && ticks++ < max) sim.tick();
  return ticks;
}

const level = (w: GridWorld, x: number, y: number, z: number) => FLUID_LEVEL[w.getBlock(x, y, z)];

/** One-wide channel along +X at y = 1 with a source at x = 0 and a dirt dam at x = 1. */
function channel(length = 12) {
  const w = new GridWorld();
  for (let x = -1; x <= length; x++) {
    w.setBlock(x, 1, 1, B.STONE);
    w.setBlock(x, 1, -1, B.STONE);
  }
  w.setBlock(-1, 1, 0, B.STONE);
  w.setBlock(length, 1, 0, B.STONE);
  w.setBlock(0, 1, 0, B.WATER);
  w.setBlock(1, 1, 0, B.DIRT);
  return { w, sim: new FluidSimulator(w) };
}

function breakDam(w: GridWorld, sim: FluidSimulator) {
  w.setBlock(1, 1, 0, B.AIR);
  sim.notify(1, 1, 0);
  settle(sim);
}

describe("water rules", () => {
  it("spreads 7 blocks from a source, one level lower each block", () => {
    const { w, sim } = channel();
    breakDam(w, sim);
    for (let x = 1; x <= 7; x++) expect(level(w, x, 1, 0)).toBe(8 - x);
    expect(level(w, 8, 1, 0)).toBe(0);
    expect(level(w, 0, 1, 0)).toBe(8);
  });

  it("surfaces get lower with distance", () => {
    const { w, sim } = channel();
    breakDam(w, sim);
    const heights = [1, 2, 3, 4, 5, 6, 7].map((x) => waterHeight16(w.getBlock(x, 1, 0), w.getBlock(x, 2, 0)));
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeLessThanOrEqual(heights[i - 1]);
    expect(heights[0]).toBeGreaterThan(heights[6]);
  });

  it("reaches 7 blocks in every direction on open ground (a diamond)", () => {
    const w = new GridWorld();
    w.setBlock(0, 1, 0, B.WATER);
    const sim = new FluidSimulator(w);
    sim.notify(0, 1, 0);
    settle(sim);
    for (let x = -9; x <= 9; x++) {
      for (let z = -9; z <= 9; z++) {
        const d = Math.abs(x) + Math.abs(z);
        expect(level(w, x, 1, z)).toBe(d === 0 ? 8 : d <= 7 ? 8 - d : 0);
      }
    }
  });

  it("falls straight down and spreads again where it lands", () => {
    const w = new GridWorld();
    // A ledge: stone pillar under a source at y = 10, open air down to the ground at y = 1.
    for (let y = 1; y <= 9; y++) w.setBlock(0, y, 0, B.STONE);
    w.setBlock(0, 10, 0, B.WATER);
    for (let y = 1; y <= 10; y++) for (const [x, z] of [[0, -1], [-1, 0], [0, 1]]) w.setBlock(x, y, z, B.STONE);
    const sim = new FluidSimulator(w);
    sim.notify(0, 10, 0);
    settle(sim);
    // The source spills onto (1,10,0), which has nothing under it, so it pours down.
    for (let y = 1; y <= 9; y++) expect(level(w, 1, y, 0)).toBe(9);
    // On the ground the flow resets: 7 next to the waterfall, fading out after that.
    expect(level(w, 2, 1, 0)).toBe(7);
    expect(level(w, 8, 1, 0)).toBe(1);
    expect(level(w, 9, 1, 0)).toBe(0);
    // Mid-air falling water does not spread sideways.
    expect(level(w, 2, 5, 0)).toBe(0);
  });

  it("heads for the nearest drop within 5 blocks instead of spreading everywhere", () => {
    const w = new GridWorld();
    // Flat platform at y = 5 (stone), with a hole 3 blocks east of the source.
    for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) w.setBlock(x, 4, z, B.STONE);
    w.setBlock(3, 4, 0, B.AIR);
    w.setBlock(0, 5, 0, B.WATER);
    expect(flowDirections(w, 0, 5, 0)).toEqual([true, false, false, false]);
    const sim = new FluidSimulator(w);
    sim.notify(0, 5, 0);
    settle(sim);
    expect(level(w, 1, 5, 0)).toBe(7);
    expect(level(w, 2, 5, 0)).toBe(6);
    expect(level(w, 3, 5, 0)).toBe(5);
    // Nothing went the other way.
    expect(level(w, -1, 5, 0)).toBe(0);
    expect(level(w, 0, 5, 1)).toBe(0);
    // And it pours down the hole.
    expect(level(w, 3, 4, 0)).toBe(9);
  });

  it("spreads in every direction when no drop is in range", () => {
    const w = new GridWorld();
    w.setBlock(0, 1, 0, B.WATER);
    expect(flowDirections(w, 0, 1, 0)).toEqual([true, true, true, true]);
  });

  it("makes a new source between two sources (infinite water)", () => {
    const w = new GridWorld();
    // 3x1 trench: stone walls around three cells.
    for (let x = -1; x <= 3; x++) { w.setBlock(x, 1, 1, B.STONE); w.setBlock(x, 1, -1, B.STONE); }
    w.setBlock(-1, 1, 0, B.STONE);
    w.setBlock(3, 1, 0, B.STONE);
    w.setBlock(0, 1, 0, B.WATER);
    w.setBlock(2, 1, 0, B.WATER);
    const sim = new FluidSimulator(w);
    sim.notify(1, 1, 0);
    settle(sim);
    expect(w.getBlock(1, 1, 0)).toBe(B.WATER);
    // Scoop the middle out: it refills.
    w.setBlock(1, 1, 0, B.AIR);
    sim.notify(1, 1, 0);
    settle(sim);
    expect(w.getBlock(1, 1, 0)).toBe(B.WATER);
  });

  it("drains when the source is removed", () => {
    const { w, sim } = channel();
    breakDam(w, sim);
    w.setBlock(0, 1, 0, B.AIR);
    sim.notify(0, 1, 0);
    settle(sim);
    for (let x = 0; x <= 8; x++) expect(level(w, x, 1, 0)).toBe(0);
  });

  it("stops flowing when a block is put back", () => {
    const { w, sim } = channel();
    breakDam(w, sim);
    w.setBlock(1, 1, 0, B.DIRT);
    sim.notify(1, 1, 0);
    settle(sim);
    for (let x = 2; x <= 8; x++) expect(level(w, x, 1, 0)).toBe(0);
    expect(w.getBlock(0, 1, 0)).toBe(B.WATER);
  });

  it("washes away plants", () => {
    const { w, sim } = channel();
    const washed: number[] = [];
    sim.onWashedAway = (_x, _y, _z, id) => washed.push(id);
    w.setBlock(3, 1, 0, B.TALL_GRASS);
    breakDam(w, sim);
    expect(level(w, 3, 1, 0)).toBe(5);
    expect(washed).toEqual([B.TALL_GRASS]);
  });

  it("advances one block per tick", () => {
    const { w, sim } = channel();
    w.setBlock(1, 1, 0, B.AIR);
    sim.notify(1, 1, 0);
    sim.tick();
    expect(level(w, 1, 1, 0)).toBe(7);
    expect(level(w, 2, 1, 0)).toBe(0);
    sim.tick();
    expect(level(w, 2, 1, 0)).toBe(6);
  });

  it("pure rule leaves solid blocks and sources alone", () => {
    const w = new GridWorld();
    w.setBlock(0, 1, 0, B.STONE);
    w.setBlock(1, 1, 0, B.WATER);
    expect(nextFluidState(w, 0, 1, 0)).toBe(B.STONE);
    expect(nextFluidState(w, 1, 1, 0)).toBe(B.WATER);
  });

  it("respects the per-tick budget", () => {
    const w = new GridWorld();
    const sim = new FluidSimulator(w, 5);
    for (let i = 0; i < 10; i++) sim.notify(i * 20, 5, 0);
    const before = sim.pending;
    sim.tick();
    expect(sim.pending).toBe(before - 5);
  });
});

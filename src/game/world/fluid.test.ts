import { describe, expect, it } from "vitest";
import { B, FLUID_LEVEL, waterHeight16 } from "./blocks";
import { FluidSimulator, nextFluidState, type FluidWorld } from "./fluid";

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

/** Runs fluid ticks until nothing is queued (with a safety cap). */
function settle(sim: FluidSimulator, max = 100) {
  let ticks = 0;
  while (sim.pending && ticks++ < max) sim.tick();
  return ticks;
}

const height = (w: GridWorld, x: number, y: number, z: number) => waterHeight16(w.getBlock(x, y, z), w.getBlock(x, y + 1, z)) / 16;

/**
 * A one-wide channel along +X at y = 1: a source at x = 0, a dirt dam at
 * x = 1, open channel beyond, stone walls at z = ±1.
 */
function channel() {
  const w = new GridWorld();
  for (let x = -1; x <= 8; x++) {
    w.setBlock(x, 1, 1, B.STONE);
    w.setBlock(x, 1, -1, B.STONE);
  }
  w.setBlock(-1, 1, 0, B.STONE);
  w.setBlock(0, 1, 0, B.WATER);
  w.setBlock(1, 1, 0, B.DIRT);
  const sim = new FluidSimulator(w);
  return { w, sim };
}

describe("nextFluidState (pure rule)", () => {
  const base: { above: number; below: number; sidesBelow: number[] } = { above: B.AIR, below: B.DIRT, sidesBelow: [B.DIRT, B.DIRT, B.DIRT, B.DIRT] };
  const n = (self: number, sides: number[], over: Partial<typeof base> = {}) => ({
    ...base,
    ...over,
    self,
    sides: sides as [number, number, number, number],
    sidesBelow: [...base.sidesBelow] as [number, number, number, number],
  });

  it("a cell beside a source becomes full flowing water", () => {
    expect(nextFluidState(n(B.AIR, [B.WATER, B.AIR, B.AIR, B.AIR]))).toBe(B.WATER_FLOW_3);
  });
  it("each step away loses one level and level 1 feeds nothing", () => {
    expect(nextFluidState(n(B.AIR, [B.WATER_FLOW_3, B.AIR, B.AIR, B.AIR]))).toBe(B.WATER_FLOW_2);
    expect(nextFluidState(n(B.AIR, [B.WATER_FLOW_2, B.AIR, B.AIR, B.AIR]))).toBe(B.WATER_FLOW_1);
    expect(nextFluidState(n(B.AIR, [B.WATER_FLOW_1, B.AIR, B.AIR, B.AIR]))).toBe(B.AIR);
  });
  it("water above makes falling water", () => {
    expect(nextFluidState(n(B.AIR, [B.AIR, B.AIR, B.AIR, B.AIR], { above: B.WATER }))).toBe(B.WATER_FLOW_3);
  });
  it("an unfed cell recedes one level at a time", () => {
    expect(nextFluidState(n(B.WATER_FLOW_3, [B.AIR, B.AIR, B.AIR, B.AIR]))).toBe(B.WATER_FLOW_2);
    expect(nextFluidState(n(B.WATER_FLOW_1, [B.AIR, B.AIR, B.AIR, B.AIR]))).toBe(B.AIR);
  });
  it("sources and solid blocks never change", () => {
    expect(nextFluidState(n(B.WATER, []))).toBe(B.WATER);
    expect(nextFluidState(n(B.STONE, [B.WATER, B.WATER, B.WATER, B.WATER]))).toBe(B.STONE);
  });
  it("a neighbour over a drop does not spread sideways", () => {
    const state = n(B.AIR, [B.WATER_FLOW_3, B.AIR, B.AIR, B.AIR]);
    state.sidesBelow[0] = B.AIR;
    expect(nextFluidState(state)).toBe(B.AIR);
  });
});

describe("FluidSimulator", () => {
  it("breaking the dam beside a source fills exactly three cells: 1.0, 0.5, 0.2", () => {
    const { w, sim } = channel();
    w.setBlock(1, 1, 0, B.AIR);
    sim.notify(1, 1, 0);
    settle(sim);
    expect(w.getBlock(1, 1, 0)).toBe(B.WATER_FLOW_3);
    expect(w.getBlock(2, 1, 0)).toBe(B.WATER_FLOW_2);
    expect(w.getBlock(3, 1, 0)).toBe(B.WATER_FLOW_1);
    expect(w.getBlock(4, 1, 0)).toBe(B.AIR);
    expect(height(w, 1, 1, 0)).toBe(1);
    expect(height(w, 2, 1, 0)).toBe(0.5);
    expect(height(w, 3, 1, 0)).toBeCloseTo(0.2, 1);
  });

  it("spreads one cell per tick", () => {
    const { w, sim } = channel();
    w.setBlock(1, 1, 0, B.AIR);
    sim.notify(1, 1, 0);
    sim.tick();
    expect(w.getBlock(1, 1, 0)).toBe(B.WATER_FLOW_3);
    expect(w.getBlock(2, 1, 0)).toBe(B.AIR);
    sim.tick();
    expect(w.getBlock(2, 1, 0)).toBe(B.WATER_FLOW_2);
  });

  it("on open ground water reaches 3 cells in every direction and no further", () => {
    const w = new GridWorld();
    w.setBlock(0, 1, 0, B.WATER);
    const sim = new FluidSimulator(w);
    sim.notify(0, 1, 0);
    settle(sim);
    for (let x = -5; x <= 5; x++) {
      for (let z = -5; z <= 5; z++) {
        const d = Math.abs(x) + Math.abs(z);
        const level = FLUID_LEVEL[w.getBlock(x, 1, z)];
        expect(level).toBe(d === 0 ? 4 : d <= 3 ? 4 - d : 0);
      }
    }
  });

  it("removing the source drains the whole chain", () => {
    const { w, sim } = channel();
    w.setBlock(1, 1, 0, B.AIR);
    sim.notify(1, 1, 0);
    settle(sim);
    w.setBlock(0, 1, 0, B.AIR);
    sim.notify(0, 1, 0);
    settle(sim);
    for (let x = 0; x <= 4; x++) expect(w.getBlock(x, 1, 0)).toBe(B.AIR);
  });

  it("water falls into air below and spreads where it lands", () => {
    const w = new GridWorld();
    // Ground at y = 0, a 4-high drop from a ledge source at y = 5.
    w.setBlock(0, 4, 0, B.STONE);
    w.setBlock(0, 5, 0, B.WATER);
    w.setBlock(1, 4, 0, B.AIR);
    const sim = new FluidSimulator(w);
    // Source rests on stone, so it spreads to (1,5,0), which falls down the gap.
    sim.notify(0, 5, 0);
    settle(sim);
    expect(w.getBlock(1, 5, 0)).toBe(B.WATER_FLOW_3);
    for (let y = 1; y <= 4; y++) expect(w.getBlock(1, y, 0)).toBe(B.WATER_FLOW_3);
    // Landed on the ground at y = 1 and spread from there.
    expect(w.getBlock(2, 1, 0)).toBe(B.WATER_FLOW_2);
    expect(w.getBlock(3, 1, 0)).toBe(B.WATER_FLOW_1);
    // The falling column itself does not spread sideways in mid-air.
    expect(w.getBlock(2, 3, 0)).toBe(B.AIR);
  });

  it("placing a block back into the gap stops the flow", () => {
    const { w, sim } = channel();
    w.setBlock(1, 1, 0, B.AIR);
    sim.notify(1, 1, 0);
    settle(sim);
    w.setBlock(1, 1, 0, B.DIRT);
    sim.notify(1, 1, 0);
    settle(sim);
    expect(w.getBlock(1, 1, 0)).toBe(B.DIRT);
    expect(w.getBlock(2, 1, 0)).toBe(B.AIR);
    expect(w.getBlock(3, 1, 0)).toBe(B.AIR);
    expect(w.getBlock(0, 1, 0)).toBe(B.WATER);
  });

  it("washes away plants it flows over", () => {
    const { w, sim } = channel();
    const washed: number[] = [];
    sim.onWashedAway = (_x, _y, _z, id) => washed.push(id);
    w.setBlock(2, 1, 0, B.TALL_GRASS);
    w.setBlock(1, 1, 0, B.AIR);
    sim.notify(1, 1, 0);
    settle(sim);
    expect(w.getBlock(2, 1, 0)).toBe(B.WATER_FLOW_2);
    expect(washed).toEqual([B.TALL_GRASS]);
  });

  it("respects the per-tick budget", () => {
    const w = new GridWorld();
    const sim = new FluidSimulator(w, 5);
    for (let i = 0; i < 20; i++) sim.notify(i * 10, 5, 0);
    sim.tick();
    expect(sim.pending).toBe(20 * 7 - 5);
  });
});

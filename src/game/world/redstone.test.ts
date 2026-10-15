import { describe, expect, it } from "vitest";
import { B, doorBlock, doorState, leverBlock, wireBlock, wirePower } from "./blocks";
import { RedstoneSim, blockPowered, sourcePower, torchShouldBeLit, wireShape, wireTarget, type RedstoneWorld } from "./redstone";

/** Everything at y <= 0 is stone, air above unless set. */
class Grid implements RedstoneWorld {
  cells = new Map<string, number>();
  /** Like the game's world, every change wakes the simulator around it. */
  sim: RedstoneSim | null = null;
  getBlock(x: number, y: number, z: number) {
    return this.cells.get(`${x},${y},${z}`) ?? (y <= 0 ? B.STONE : B.AIR);
  }
  setBlock(x: number, y: number, z: number, id: number) {
    if (this.getBlock(x, y, z) === id) return false;
    this.cells.set(`${x},${y},${z}`, id);
    this.sim?.notify(x, y, z);
    return true;
  }
}

function setup() {
  const w = new Grid();
  const sim = new RedstoneSim(w);
  w.sim = sim;
  return { w, sim };
}

const settle = (sim: RedstoneSim, seconds = 2) => {
  for (let t = 0; t < seconds; t += 0.05) sim.tick(0.05);
};

describe("redstone", () => {
  it("levers and lit torches are sources", () => {
    expect(sourcePower(leverBlock(0, true))).toBe(15);
    expect(sourcePower(leverBlock(0, false))).toBe(0);
    expect(sourcePower(B.REDSTONE_TORCH)).toBe(15);
    expect(sourcePower(B.REDSTONE_TORCH_OFF)).toBe(0);
    expect(sourcePower(B.PRESSURE_PLATE_ON)).toBe(15);
  });

  it("dust loses one level per block from a lever", () => {
    const { w, sim } = setup();
    w.setBlock(0, 1, 0, leverBlock(0, true));
    for (let x = 1; x <= 17; x++) w.setBlock(x, 1, 0, B.WIRE_0);
    settle(sim);
    expect(wirePower(w.getBlock(1, 1, 0))).toBe(15);
    expect(wirePower(w.getBlock(2, 1, 0))).toBe(14);
    expect(wirePower(w.getBlock(15, 1, 0))).toBe(1);
    expect(wirePower(w.getBlock(16, 1, 0))).toBe(0);
    expect(wireTarget(w, 3, 1, 0)).toBe(13);
  });

  it("keeps the strongest of two sources when one goes away", () => {
    const { w, sim } = setup();
    w.setBlock(0, 1, 0, leverBlock(0, true));
    w.setBlock(6, 1, 0, leverBlock(0, true));
    for (let x = 1; x <= 5; x++) w.setBlock(x, 1, 0, B.WIRE_0);
    settle(sim);
    expect(wirePower(w.getBlock(3, 1, 0))).toBe(13);
    w.setBlock(0, 1, 0, leverBlock(0, false));
    settle(sim);
    expect([1, 2, 3, 4, 5].map((x) => wirePower(w.getBlock(x, 1, 0)))).toEqual([11, 12, 13, 14, 15]);
  });

  it("dust goes dark when the lever is switched off", () => {
    const { w, sim } = setup();
    w.setBlock(0, 1, 0, leverBlock(0, true));
    for (let x = 1; x <= 5; x++) w.setBlock(x, 1, 0, B.WIRE_0);
    settle(sim);
    expect(wirePower(w.getBlock(5, 1, 0))).toBe(11);
    w.setBlock(0, 1, 0, leverBlock(0, false));
    settle(sim);
    for (let x = 1; x <= 5; x++) expect(w.getBlock(x, 1, 0)).toBe(B.WIRE_0);
  });

  it("a torch on a powered block turns off (inverter)", () => {
    const w = new Grid();
    // Torch on top of a stone block at (0,1,0); a lever on the block's side.
    w.setBlock(0, 1, 0, B.STONE);
    w.setBlock(0, 2, 0, B.REDSTONE_TORCH);
    expect(torchShouldBeLit(w, 0, 2, 0)).toBe(true);
    w.setBlock(1, 1, 0, leverBlock(3, true)); // face 3 hangs on -X, i.e. on the stone
    expect(blockPowered(w, 0, 1, 0)).toBe(true);
    expect(torchShouldBeLit(w, 0, 2, 0)).toBe(false);
    const sim = new RedstoneSim(w);
    sim.notify(1, 1, 0);
    settle(sim, 0.3);
    expect(w.getBlock(0, 2, 0)).toBe(B.REDSTONE_TORCH_OFF);
  });

  it("a redstone torch on a wall turns off when that wall block is powered", () => {
    const { w, sim } = setup();
    w.setBlock(0, 1, 0, B.STONE);
    w.setBlock(1, 1, 0, B.REDSTONE_WALL_TORCH + 2); // hangs on the stone at -X
    expect(torchShouldBeLit(w, 1, 1, 0)).toBe(true);
    expect(sourcePower(w.getBlock(1, 1, 0))).toBe(15);
    w.setBlock(-1, 1, 0, leverBlock(4, true)); // lever on the stone's other side
    settle(sim, 0.4);
    expect(w.getBlock(1, 1, 0)).toBe(B.REDSTONE_WALL_TORCH_OFF + 2);
  });

  it("iron doors open while powered and close after", () => {
    const w = new Grid();
    w.setBlock(0, 1, 0, doorBlock(true, 0, false, false));
    w.setBlock(0, 2, 0, doorBlock(true, 0, false, true));
    w.setBlock(1, 1, 0, leverBlock(0, true));
    const sim = new RedstoneSim(w);
    sim.notify(1, 1, 0);
    settle(sim);
    expect(doorState(w.getBlock(0, 1, 0)).open).toBe(true);
    expect(doorState(w.getBlock(0, 2, 0)).open).toBe(true);
    w.setBlock(1, 1, 0, leverBlock(0, false));
    sim.notify(1, 1, 0);
    settle(sim);
    expect(doorState(w.getBlock(0, 1, 0)).open).toBe(false);
  });

  it("draws dust as a line or a cross", () => {
    const w = new Grid();
    w.setBlock(0, 1, 0, wireBlock(0));
    expect(wireShape(w, 0, 1, 0)).toBe("cross");
    w.setBlock(1, 1, 0, wireBlock(0));
    expect(wireShape(w, 0, 1, 0)).toBe("x");
    w.setBlock(0, 1, 1, wireBlock(0));
    expect(wireShape(w, 0, 1, 0)).toBe("cross");
  });
});

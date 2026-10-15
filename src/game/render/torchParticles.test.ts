import { describe, expect, it } from "vitest";
import { B } from "../world/blocks";
import { flameTip, hasFlame } from "./torchParticles";

describe("torch flames", () => {
  it("burn on torches and lit redstone torches only", () => {
    for (const id of [B.TORCH, B.WALL_TORCH, B.WALL_TORCH + 3, B.REDSTONE_TORCH, B.REDSTONE_WALL_TORCH + 1]) expect(hasFlame(id)).toBe(true);
    for (const id of [B.REDSTONE_TORCH_OFF, B.REDSTONE_WALL_TORCH_OFF, B.AIR, B.LEVER]) expect(hasFlame(id)).toBe(false);
  });

  it("sit on top of a standing torch and lean out from a wall", () => {
    expect(flameTip(B.TORCH, 0, 0, 0)).toEqual([0.5, 0.72, 0.5]);
    // Face 1 hangs on the block at -Z: the tip is higher than a standing flame and still on the wall side of centre.
    const [x, y, z] = flameTip(B.WALL_TORCH, 0, 0, 0);
    expect(x).toBeCloseTo(0.5);
    expect(y).toBeGreaterThan(0.72);
    expect(z).toBeLessThan(0.5);
  });
});

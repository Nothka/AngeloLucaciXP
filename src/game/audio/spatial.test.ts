import { describe, expect, it } from "vitest";
import { HEARING_RANGE, spatialize } from "./spatial";

const facingNorth = { x: 0, y: 64, z: 0, yaw: 0 }; // looking toward -Z, so +X is on the right

describe("sound placement", () => {
  it("is silent from 16 blocks away", () => {
    expect(HEARING_RANGE).toBe(16);
    expect(spatialize(facingNorth, 16, 64, 0)).toBeNull();
    expect(spatialize(facingNorth, 0, 64, -20)).toBeNull();
    expect(spatialize(facingNorth, 15.9, 64, 0)).not.toBeNull();
  });

  it("gets louder the closer the source is", () => {
    const far = spatialize(facingNorth, 0, 64, -12)!.volume;
    const mid = spatialize(facingNorth, 0, 64, -6)!.volume;
    const near = spatialize(facingNorth, 0, 64, -1)!.volume;
    expect(near).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(far);
    expect(spatialize(facingNorth, 0, 64, 0)!.volume).toBe(1);
    expect(spatialize(facingNorth, 8, 64, 0)!.volume).toBeCloseTo(0.5);
  });

  it("plays a sound on your right only in the right channel", () => {
    expect(spatialize(facingNorth, 5, 64, 0)!.pan).toBeCloseTo(1);
    expect(spatialize(facingNorth, -5, 64, 0)!.pan).toBeCloseTo(-1);
    expect(spatialize(facingNorth, 0, 64, -5)!.pan).toBeCloseTo(0);
    expect(spatialize(facingNorth, 0, 70, 0)!.pan).toBeCloseTo(0);
  });

  it("follows the camera as it turns", () => {
    // Turned to look toward -X: a cow at +X is now behind, one at -Z is on the right.
    const facingWest = { ...facingNorth, yaw: Math.PI / 2 };
    expect(spatialize(facingWest, 5, 64, 0)!.pan).toBeCloseTo(0);
    expect(spatialize(facingWest, 0, 64, -5)!.pan).toBeCloseTo(1);
    expect(spatialize(facingWest, 0, 64, 5)!.pan).toBeCloseTo(-1);
  });
});

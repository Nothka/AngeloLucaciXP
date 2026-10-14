import { describe, expect, it } from "vitest";
import { prepareSample } from "./sampleProcessing";

const RATE = 8000;

/** Silence, then a 440 Hz tone at `amp` for `seconds`, then silence. */
function clip(amp: number, seconds: number, lead = 0.5, tail = 0.5) {
  const n = Math.round((lead + seconds + tail) * RATE);
  const a = new Float32Array(n);
  for (let i = Math.round(lead * RATE); i < Math.round((lead + seconds) * RATE); i++) a[i] = amp * Math.sin((i / RATE) * 440 * Math.PI * 2);
  return a;
}
const rms = (a: Float32Array) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);

describe("sample preparation", () => {
  it("cuts the silence around the sound", () => {
    const out = prepareSample([clip(0.5, 0.4)], RATE);
    // 0.4 s of sound plus a few windows of air, not the 1.4 s recording.
    expect(out.length / RATE).toBeGreaterThan(0.38);
    expect(out.length / RATE).toBeLessThan(0.55);
  });

  it("keeps one call, not the next one after a long pause", () => {
    const a = clip(0.5, 0.5, 0.2, 0);
    const b = clip(0.5, 0.5, 0.8, 0.2);
    const both = new Float32Array(a.length + b.length);
    both.set(a);
    both.set(b, a.length);
    const out = prepareSample([both], RATE);
    expect(out.length / RATE).toBeLessThan(0.7);
  });

  it("evens out quiet and loud recordings", () => {
    const quiet = prepareSample([clip(0.02, 0.5)], RATE);
    const loud = prepareSample([clip(0.6, 0.5)], RATE);
    expect(rms(quiet) / rms(loud)).toBeGreaterThan(0.85);
    expect(rms(quiet) / rms(loud)).toBeLessThan(1.15);
  });

  it("never clips and fades its edges", () => {
    const out = prepareSample([clip(1, 0.5)], RATE, { targetRms: 2 });
    expect(Math.max(...out.map(Math.abs))).toBeLessThanOrEqual(0.951);
    expect(Math.abs(out[0])).toBeLessThan(1e-6);
    expect(Math.abs(out[out.length - 1])).toBeLessThan(1e-6);
  });

  it("mixes stereo to mono and caps the length", () => {
    const l = clip(0.5, 5), r = clip(0.5, 5);
    const out = prepareSample([l, r], RATE, { maxSeconds: 2 });
    expect(out.length).toBeLessThanOrEqual(2 * RATE);
  });

  it("returns nothing for silence", () => {
    expect(prepareSample([new Float32Array(RATE)], RATE).length).toBe(0);
  });
});

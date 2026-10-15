import { describe, expect, it } from "vitest";
import { MAX_PLAYERS, base64ToBytes, bytesToBase64, cleanName, decode, encode, isRoomCode, newRoomCode, normalizeRoomCode } from "./protocol";

describe("multiplayer messages", () => {
  it("allows five players", () => {
    expect(MAX_PLAYERS).toBe(5);
  });

  it("makes room codes that are easy to read out", () => {
    for (let i = 0; i < 200; i++) {
      const code = newRoomCode();
      expect(isRoomCode(code)).toBe(true);
      expect(code).not.toMatch(/[01ILO]/);
    }
    expect(normalizeRoomCode(" k7q-m2x ")).toBe("K7QM2X");
    expect(isRoomCode("K7QM2X")).toBe(true);
    expect(isRoomCode("K7QM2")).toBe(false);
    expect(isRoomCode("KOQM2X")).toBe(false);
  });

  it("cleans player names", () => {
    expect(cleanName("  Ana  ")).toBe("Ana");
    expect(cleanName("<script>")).toBe("script");
    expect(cleanName("")).toBe("Player");
    expect(cleanName("a".repeat(40))).toHaveLength(16);
  });

  it("round-trips messages and rejects junk", () => {
    const m = { t: "set" as const, c: [1, 64, -3, 41] };
    expect(decode(encode(m))).toEqual(m);
    expect(decode("not json")).toBeNull();
    expect(decode('{"no":"type"}')).toBeNull();
    expect(decode(42)).toBeNull();
  });

  it("carries chunk bytes as base64", () => {
    const bytes = new Uint8Array(70000).map((_, i) => (i * 7) & 255);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });
});

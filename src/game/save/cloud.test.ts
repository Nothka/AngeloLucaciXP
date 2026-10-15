import { describe, expect, it } from "vitest";
import { choosePlayer, fromCloud, toCloud } from "./cloud";
import type { WorldMeta } from "./db";

const meta = (lastPlayed: number, withPlayer = true): WorldMeta => ({
  id: "w1", name: "Home", seed: 42, seedText: "42", mode: "survival", created: 1, lastPlayed, time: 1000,
  player: withPlayer
    ? {
        pos: [10.5, 70, -3.25], yaw: 1, pitch: -0.2, flying: false, selected: 2,
        inventory: [[1, 64], null, [258, 1, 12], ...Array(33).fill(null)],
        armor: [[274, 1, 3], null, null, [277, 1]],
        xp: 57,
        vitals: { health: 14, food: 18, saturation: 2.5, air: 300 },
      }
    : null,
});

describe("cloud save format", () => {
  it("round-trips the whole player", () => {
    const m = meta(5000);
    const doc = toCloud(m, 5000)!;
    // Firestore rejects arrays inside arrays: stacks are stored as maps.
    expect(doc.player.inventory[0]).toEqual({ id: 1, count: 64 });
    expect(doc.player.inventory[2]).toEqual({ id: 258, count: 1, wear: 12 });
    const back = fromCloud(JSON.parse(JSON.stringify(doc)))!;
    expect(back.savedAt).toBe(5000);
    expect(back.player).toEqual(m.player);
  });

  it("ignores malformed stacks and documents", () => {
    expect(fromCloud(null)).toBeNull();
    expect(fromCloud({ player: { pos: { x: 0, y: 0, z: 0 } } })).toBeNull();
    const back = fromCloud({ savedAt: 1, player: { pos: { x: 0, y: 64, z: 0 }, inventory: [{ id: 1, count: 999 }, { id: "x", count: 1 }, { id: 3, count: 5 }] } })!;
    expect(back.player.inventory).toEqual([null, null, [3, 5]]);
    expect(back.player.vitals).toBeUndefined();
  });

  it("loads the cloud copy only when it is newer", () => {
    const local = meta(5000);
    const older = { player: { ...local.player!, xp: 1 }, savedAt: 4000 };
    const newer = { player: { ...local.player!, xp: 99 }, savedAt: 6000 };
    expect(choosePlayer(local, older)?.xp).toBe(57);
    expect(choosePlayer(local, newer)?.xp).toBe(99);
    expect(choosePlayer(local, null)?.xp).toBe(57);
    expect(choosePlayer(meta(5000, false), older)?.xp).toBe(1);
  });
});

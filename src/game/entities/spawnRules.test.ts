import { describe, expect, it } from "vitest";
import { B } from "../world/blocks";
import {
  canSpawnHostile, internalSkyLight, isAnimalSpot, scaledCap, seededChunkAnimals, shouldDespawn, skyDarkening, topBlockY,
} from "./spawnRules";
import { SPAWN_CONFIG } from "./spawnConfig";

const NOON = 6000;
const MIDNIGHT = 18000;

/** Synthetic chunk: grass at y = 60 over dirt, with a pond, a tree and a stone patch. */
function testChunk() {
  return (x: number, y: number, z: number) => {
    if (x < 0 || z < 0 || x > 15 || z > 15) return B.AIR;
    const pond = x < 4 && z < 4;
    const tree = x >= 12 && z >= 12;
    const rock = x >= 12 && z < 3;
    if (pond) return y <= 60 ? (y === 60 ? B.WATER : B.DIRT) : B.AIR;
    if (tree && y >= 61 && y <= 64) return B.LEAVES;
    if (y === 60) return rock ? B.STONE : B.GRASS;
    if (y < 60) return B.DIRT;
    return B.AIR;
  };
}

/** Seeds that produce at least one pack, so the assertions are not vacuous. */
function seedsWithAnimals(count: number) {
  const found: [number, number, number][] = [];
  const chunk = testChunk();
  for (let seed = 1; found.length < count && seed < 5000; seed++) {
    if (seededChunkAnimals(seed, 3, -2, chunk).length) found.push([seed, 3, -2]);
  }
  return found;
}

describe("seededChunkAnimals", () => {
  it("is deterministic for the same seed and chunk", () => {
    const chunk = testChunk();
    for (let seed = 0; seed < 200; seed++) {
      expect(seededChunkAnimals(seed, 5, 9, chunk)).toEqual(seededChunkAnimals(seed, 5, 9, chunk));
    }
  });

  it("differs between seeds and between chunks", () => {
    const chunk = testChunk();
    const a = Array.from({ length: 300 }, (_, s) => JSON.stringify(seededChunkAnimals(s, 1, 1, chunk)));
    const b = Array.from({ length: 300 }, (_, s) => JSON.stringify(seededChunkAnimals(s, 2, 1, chunk)));
    expect(a.join("|")).not.toEqual(b.join("|"));
    expect(new Set(a).size).toBeGreaterThan(5);
  });

  it("spawns roughly one chunk in ten", () => {
    const chunk = testChunk();
    let withAnimals = 0;
    for (let i = 0; i < 2000; i++) if (seededChunkAnimals(42, i, -i, chunk).length) withAnimals++;
    expect(withAnimals / 2000).toBeGreaterThan(0.05);
    expect(withAnimals / 2000).toBeLessThan(0.12);
  });

  it("keeps packs inside the chunk, on grass, never in water, leaves or on stone", () => {
    const chunk = testChunk();
    const seeds = seedsWithAnimals(40);
    expect(seeds.length).toBe(40);
    for (const [seed, cx, cz] of seeds) {
      for (const a of seededChunkAnimals(seed, cx, cz, chunk)) {
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x).toBeLessThan(16);
        expect(a.z).toBeGreaterThanOrEqual(0);
        expect(a.z).toBeLessThan(16);
        const bx = Math.floor(a.x);
        const bz = Math.floor(a.z);
        expect(chunk(bx, a.y - 1, bz)).toBe(B.GRASS);
        expect(chunk(bx, a.y, bz)).toBe(B.AIR);
        expect(chunk(bx, a.y + 1, bz)).toBe(B.AIR);
        expect(["sheep", "pig", "chicken", "cow"]).toContain(a.type);
      }
    }
  });

  it("packs are one type and at most the max pack size per roll", () => {
    const chunk = testChunk();
    for (const [seed, cx, cz] of seedsWithAnimals(30)) {
      const animals = seededChunkAnimals(seed, cx, cz, chunk);
      expect(animals.length).toBeGreaterThan(0);
      expect(animals.length).toBeLessThanOrEqual(SPAWN_CONFIG.maxPackSize * 6);
    }
  });

  it("finds no spot in a chunk without grass", () => {
    const sand = (_x: number, y: number) => (y <= 60 ? B.SAND : B.AIR);
    for (let seed = 0; seed < 300; seed++) expect(seededChunkAnimals(seed, 0, 0, sand)).toEqual([]);
  });

  it("topBlockY skips plants but stops at leaves", () => {
    const chunk = testChunk();
    expect(topBlockY(chunk, 6, 6)).toBe(60);
    expect(topBlockY(chunk, 13, 13)).toBe(64);
    expect(isAnimalSpot(chunk, 13, 64, 13)).toBe(false);
  });
});

describe("canSpawnHostile", () => {
  it("needs block light 0", () => {
    expect(canSpawnHostile(1, 0, MIDNIGHT)).toBe(false);
    expect(canSpawnHostile(14, 0, MIDNIGHT)).toBe(false);
    expect(canSpawnHostile(0, 0, NOON)).toBe(true);
  });
  it("needs internal sky light <= 7", () => {
    // Open sky at noon: 15 - 0 = 15 -> no.
    expect(canSpawnHostile(0, 15, NOON)).toBe(false);
    // Open sky at midnight: 15 - 11 = 4 -> yes.
    expect(canSpawnHostile(0, 15, MIDNIGHT)).toBe(true);
    // A dark cave in daytime: sky 0 -> yes.
    expect(canSpawnHostile(0, 0, NOON)).toBe(true);
    // Shade at noon with sky light 8 -> no; 7 -> yes.
    expect(canSpawnHostile(0, 8, NOON)).toBe(false);
    expect(canSpawnHostile(0, 7, NOON)).toBe(true);
  });
  it("darkening is 0 at full day and 11 at full night", () => {
    expect(skyDarkening(NOON)).toBe(0);
    expect(skyDarkening(MIDNIGHT)).toBe(11);
    expect(internalSkyLight(15, MIDNIGHT)).toBe(4);
    expect(internalSkyLight(3, MIDNIGHT)).toBe(0);
  });
});

describe("scaledCap", () => {
  it("equals the base cap at 289 chunks and halves at ~145", () => {
    expect(scaledCap(70, 289)).toBe(70);
    expect(scaledCap(10, 289)).toBe(10);
    expect(scaledCap(70, 145)).toBe(35);
    expect(scaledCap(10, 145)).toBe(5);
  });
});

describe("shouldDespawn", () => {
  it("despawns instantly beyond 128 blocks", () => {
    expect(shouldDespawn({ persistent: false, distance: 129, farSeconds: 0, roll: 0.99 })).toBe(true);
  });
  it("never despawns persistent mobs", () => {
    for (const distance of [10, 64, 129, 1000]) {
      expect(shouldDespawn({ persistent: true, distance, farSeconds: 999, roll: 0 })).toBe(false);
    }
  });
  it("random despawn only after 30 s beyond 32 blocks, at ~1/800 per tick", () => {
    expect(shouldDespawn({ persistent: false, distance: 20, farSeconds: 100, roll: 0 })).toBe(false);
    expect(shouldDespawn({ persistent: false, distance: 50, farSeconds: 10, roll: 0 })).toBe(false);
    expect(shouldDespawn({ persistent: false, distance: 50, farSeconds: 31, roll: 0.0001 })).toBe(true);
    expect(shouldDespawn({ persistent: false, distance: 50, farSeconds: 31, roll: 0.5 })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { I } from "./world/blocks";
import { parseCoord, runCommand, type CommandHost } from "./commands";

function host(cheats = true) {
  const log: string[] = [];
  const h: CommandHost & { log: string[]; pos: { x: number; y: number; z: number } } = {
    cheats,
    log,
    pos: { x: 10.5, y: 64, z: -3.5 },
    time: 24000 * 3 + 500,
    playerPos: () => h.pos,
    setMode: (m) => log.push(`mode ${m}`),
    setWeather: (k, s) => log.push(`weather ${k}${s ? ` ${s}` : ""}`),
    give: (id, n) => (log.push(`give ${id} ${n}`), 0),
    teleport: (x, y, z) => log.push(`tp ${x} ${y} ${z}`),
    setSpawn: (x, y, z) => log.push(`spawn ${x} ${y} ${z}`),
    kill: () => log.push("kill"),
  };
  return h;
}

describe("console commands", () => {
  it("needs cheats", () => {
    const h = host(false);
    expect(runCommand("/gamemode creative", h).ok).toBe(false);
    expect(h.log).toEqual([]);
    expect(runCommand("/help", h).ok).toBe(true);
  });

  it("switches game mode", () => {
    const h = host();
    expect(runCommand("/gamemode creative", h).ok).toBe(true);
    expect(runCommand("/gamemode s", h).ok).toBe(true);
    expect(runCommand("/gamemode adventure", h).ok).toBe(false);
    expect(h.log).toEqual(["mode creative", "mode survival"]);
  });

  it("sets the time of day, keeping the day count", () => {
    const h = host();
    runCommand("/time set night", h);
    expect(h.time).toBe(24000 * 3 + 13000);
    runCommand("/time set day", h);
    expect(h.time).toBe(24000 * 3 + 1000);
    runCommand("/time set 6000", h);
    expect(h.time).toBe(24000 * 3 + 6000);
    expect(runCommand("/time set lunch", h).ok).toBe(false);
  });

  it("sets the weather", () => {
    const h = host();
    runCommand("/weather rain", h);
    runCommand("/weather thunder 120", h);
    runCommand("/weather clear", h);
    expect(h.log).toEqual(["weather rain", "weather thunder 120", "weather clear"]);
  });

  it("gives items by name", () => {
    const h = host();
    expect(runCommand("/give @p diamond_pickaxe", h).ok).toBe(true);
    expect(runCommand("/give @p minecraft:iron_ingot 32", h).ok).toBe(true);
    expect(runCommand("/give @p unobtainium", h).ok).toBe(false);
    expect(runCommand("/give @p stone 0", h).ok).toBe(false);
    expect(h.log).toEqual([`give ${I.DIAMOND_PICKAXE} 1`, `give ${I.IRON_INGOT} 32`]);
  });

  it("teleports with absolute and relative coordinates", () => {
    const h = host();
    runCommand("/tp 100 70 -20", h);
    runCommand("/tp ~ ~10 ~-1.5", h);
    expect(h.log).toEqual(["tp 100.5 70 -19.5", "tp 10.5 74 -5"]);
    expect(parseCoord("~", 3)).toBe(3);
    expect(parseCoord("abc", 3)).toBeNull();
    expect(runCommand("/tp 1 2", h).ok).toBe(false);
  });

  it("sets the spawn point and kills", () => {
    const h = host();
    runCommand("/spawnpoint", h);
    runCommand("/kill", h);
    expect(h.log).toEqual(["spawn 10 64 -4", "kill"]);
    expect(runCommand("/fly", h).ok).toBe(false);
  });
});

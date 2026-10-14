import { DAY_TICKS } from "./config";
import { getItem, itemByKey } from "./world/blocks";
import type { WeatherKind } from "./world/weather";
import type { GameMode } from "./player/player";

/** What commands can do to the game; the session implements it. */
export interface CommandHost {
  cheats: boolean;
  playerPos(): { x: number; y: number; z: number };
  setMode(mode: GameMode): void;
  /** Absolute world time in ticks. */
  time: number;
  setWeather(kind: WeatherKind, seconds?: number): void;
  /** Adds items; returns how many did not fit (they are dropped). */
  give(id: number, count: number): number;
  teleport(x: number, y: number, z: number): void;
  setSpawn(x: number, y: number, z: number): void;
  kill(): void;
}

export interface CommandResult {
  ok: boolean;
  message: string;
}

const TIMES: Record<string, number> = { day: 1000, noon: 6000, sunset: 12000, night: 13000, midnight: 18000, sunrise: 23000 };
const MODES: Record<string, GameMode> = { creative: "creative", c: "creative", 1: "creative", survival: "survival", s: "survival", 0: "survival" };
const WEATHER: Record<string, WeatherKind> = { clear: "clear", rain: "rain", thunder: "thunder", storm: "thunder" };

export const HELP = [
  "/gamemode <survival|creative>",
  "/time set <day|noon|night|midnight|ticks>",
  "/weather <clear|rain|thunder> [seconds]",
  "/give @p <item> [amount]",
  "/tp <x> <y> <z>   (~ for relative)",
  "/spawnpoint",
  "/kill",
];

const fail = (message: string): CommandResult => ({ ok: false, message });
const ok = (message: string): CommandResult => ({ ok: true, message });

/** Parses one coordinate, with `~` and `~n` relative to `base`. */
export function parseCoord(text: string, base: number): number | null {
  if (text.startsWith("~")) {
    const rest = text.slice(1);
    if (!rest) return base;
    const n = Number(rest);
    return Number.isFinite(n) ? base + n : null;
  }
  const n = Number(text);
  if (!Number.isFinite(n)) return null;
  // Whole numbers mean the middle of that block, as in the classic game.
  return /^-?\d+$/.test(text) ? n + 0.5 : n;
}

const isSelector = (t: string) => t.startsWith("@") || t.toLowerCase() === "player";

/** Runs a slash command (with or without the leading slash). */
export function runCommand(input: string, host: CommandHost): CommandResult {
  const parts = input.trim().replace(/^\//, "").split(/\s+/).filter(Boolean);
  if (!parts.length) return fail("Type a command, e.g. /help");
  const [name, ...args] = parts;
  const cmd = name.toLowerCase();
  if (cmd === "help" || cmd === "?") return ok(HELP.join("\n"));
  if (!["gamemode", "gm", "time", "weather", "give", "tp", "teleport", "spawnpoint", "kill"].includes(cmd)) {
    return fail(`Unknown command "${name}". Type /help for a list.`);
  }
  if (!host.cheats) return fail("Cheats are not enabled in this world");

  switch (cmd) {
    case "gamemode":
    case "gm": {
      const mode = MODES[(args[0] ?? "").toLowerCase()];
      if (!mode) return fail("Usage: /gamemode <survival|creative>");
      host.setMode(mode);
      return ok(`Set own game mode to ${mode === "creative" ? "Creative" : "Survival"} Mode`);
    }
    case "time": {
      const sub = (args[0] ?? "").toLowerCase();
      const value = (args[1] ?? "").toLowerCase();
      if (sub === "query") return ok(`The time is ${Math.floor(((host.time % DAY_TICKS) + DAY_TICKS) % DAY_TICKS)}`);
      if (sub !== "set" && sub !== "add") return fail("Usage: /time set <day|night|noon|midnight|ticks>");
      const ticks = value in TIMES ? TIMES[value] : Number(value);
      if (!Number.isFinite(ticks) || value === "") return fail(`Unknown time "${args[1] ?? ""}"`);
      if (sub === "add") host.time += ticks;
      else host.time = Math.floor(host.time / DAY_TICKS) * DAY_TICKS + (((ticks % DAY_TICKS) + DAY_TICKS) % DAY_TICKS);
      return ok(`Set the time to ${Math.floor(((host.time % DAY_TICKS) + DAY_TICKS) % DAY_TICKS)}`);
    }
    case "weather": {
      const kind = WEATHER[(args[0] ?? "").toLowerCase()];
      if (!kind) return fail("Usage: /weather <clear|rain|thunder> [seconds]");
      const secs = args[1] !== undefined ? Number(args[1]) : undefined;
      if (secs !== undefined && !(secs > 0)) return fail(`Invalid duration "${args[1]}"`);
      host.setWeather(kind, secs);
      return ok(kind === "clear" ? "Set the weather to clear" : kind === "rain" ? "Set the weather to rain" : "Set the weather to rain & thunder");
    }
    case "give": {
      const rest = args[0] && isSelector(args[0]) ? args.slice(1) : args;
      if (!rest[0]) return fail("Usage: /give @p <item> [amount]");
      const id = itemByKey(rest[0]);
      if (id === null) return fail(`Unknown item "${rest[0]}"`);
      const count = rest[1] === undefined ? 1 : Math.floor(Number(rest[1]));
      if (!(count >= 1 && count <= 2304)) return fail(`Invalid amount "${rest[1]}" (1-2304)`);
      host.give(id, count);
      return ok(`Gave ${count} [${getItem(id)?.name ?? rest[0]}] to Player`);
    }
    case "tp":
    case "teleport": {
      const rest = args[0] && isSelector(args[0]) ? args.slice(1) : args;
      if (rest.length !== 3) return fail("Usage: /tp <x> <y> <z>");
      const p = host.playerPos();
      const x = parseCoord(rest[0], p.x);
      const y = parseCoord(rest[1], p.y);
      const z = parseCoord(rest[2], p.z);
      if (x === null || y === null || z === null) return fail("Invalid position");
      // Whole-number y means standing on that block's floor, not its middle.
      const fy = /^-?\d+$/.test(rest[1]) ? y - 0.5 : y;
      if (fy < -64 || fy > 320 || Math.abs(x) > 3e7 || Math.abs(z) > 3e7) return fail("Position is out of the world");
      host.teleport(x, fy, z);
      return ok(`Teleported Player to ${x.toFixed(1)}, ${fy.toFixed(1)}, ${z.toFixed(1)}`);
    }
    case "spawnpoint": {
      const p = host.playerPos();
      const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z);
      host.setSpawn(x, y, z);
      return ok(`Set spawn point to ${x}, ${y}, ${z}`);
    }
    case "kill":
      host.kill();
      return ok("Killed Player");
  }
  return fail("Unknown command");
}

/**
 * Messages between the host and the players who joined their world. The
 * host's game is in charge: it runs the world and passes everything on;
 * guests send what their player does. Messages are JSON over one reliable,
 * ordered WebRTC data channel.
 */

import type { MobSnapshot } from "../entities/entityManager";
import type { DropNet } from "../entities/drops";
import type { OrbNet } from "../entities/xpOrbs";
import type { FurnaceState } from "../world/furnaces";
import type { WorldMeta } from "../save/db";

/** A player's own progress in a world: inventory, armor, XP, health, where they stand. */
export type PlayerSave = NonNullable<WorldMeta["player"]>;

/** Bumped whenever messages change, so old and new versions don't mix. */
export const PROTOCOL_VERSION = 3;
/** Guests see the host's mobs this far around them. */
export const MOB_RANGE = 64;
/** Host plus four friends. */
export const MAX_PLAYERS = 5;
/** How often each player sends where they are. */
export const STATE_HZ = 15;

export interface NetPlayerState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** Item in hand (0 = empty), shown in the figure's hand. */
  held: number;
  sneak: boolean;
  /** Counts up with every swing, so a missed message never loses one. */
  swings: number;
  dead: boolean;
  /** Creative players are left alone by mobs. */
  creative: boolean;
}

export interface Welcome {
  t: "welcome";
  /** The joining player's id for this session. */
  id: string;
  world: { name: string; seed: number; mode: "survival" | "creative" };
  time: number;
  weather: { kind: "clear" | "rain" | "thunder"; left: number };
  spawn: [number, number, number];
  /** Chunks the host has changed since the world was generated ("cx,cz"); everything else regenerates from the seed. */
  modified: string[];
  players: { id: string; name: string }[];
  /** Your progress from last time you played here, if any. */
  you: PlayerSave | null;
}

export type Message =
  | { t: "hello"; name: string; version: number }
  | Welcome
  | { t: "refused"; reason: string }
  | { t: "join"; id: string; name: string }
  | { t: "leave"; id: string }
  | { t: "p"; id: string; s: NetPlayerState }
  /** Block changes, flattened: x, y, z, id, x, y, z, id... */
  | { t: "set"; c: number[] }
  | { t: "chunk?"; cx: number; cz: number }
  /** A changed chunk, run-length encoded then base64; null if the host has nothing stored for it. */
  | { t: "chunk"; cx: number; cz: number; data: string | null }
  | { t: "chat"; id: string; text: string }
  | { t: "sky"; time: number; weather: { kind: "clear" | "rain" | "thunder"; left: number } }
  | { t: "bye"; reason: string }
  // ---- step 3: mobs, items, experience, arrows and furnaces (the host's world is the real one)
  /** Host: the mobs around this guest, 10 times a second. */
  | { t: "mobs"; m: MobSnapshot[] }
  /** Guest: we hit one of the host's mobs. */
  | { t: "hit"; mob: number; damage: number; weapon: number; fx: number; fz: number }
  /** Guest: we fed a mob; host: yes, it ate (use up one). */
  | { t: "feed"; mob: number; item: number }
  | { t: "fed"; item: number }
  /** Host: a mob or arrow hurt you. */
  | { t: "hurt"; amount: number; cause: "mob" | "arrow"; fx: number; fz: number }
  /** Host: items that appeared, went, or changed size. */
  | { t: "drops"; d: DropNet[] }
  | { t: "drop-"; ids: number[] }
  | { t: "drop~"; id: number; count: number }
  /** Guest: may I have this item? Host: here you go. */
  | { t: "pick"; id: number }
  | { t: "give"; item: number; count: number; wear: number }
  /** Guest: we dropped or threw something (or broke a block): make the drop. */
  | { t: "throw"; item: number; count: number; wear: number; p: [number, number, number]; v: [number, number, number] | null; delay: number }
  /** Host: experience orbs that appeared or went. Guest: make XP here. Host: you got XP. */
  | { t: "orbs"; o: OrbNet[] }
  | { t: "orb-"; ids: number[] }
  | { t: "orb"; v: number; p: [number, number, number] }
  | { t: "xp"; v: number }
  /** Host: an arrow was loosed (to show it). Guest: we shot one (host makes the real one). */
  | { t: "arrow"; a: [number, number, number, number, number, number] }
  | { t: "shoot"; a: [number, number, number, number, number, number]; damage: number; pickup: boolean }
  /** Guest: open, change or close a furnace; host: its contents. */
  | { t: "furnace?"; p: [number, number, number] }
  | { t: "furnace"; p: [number, number, number]; f: FurnaceState }
  | { t: "furnace="; p: [number, number, number]; f: FurnaceState }
  | { t: "furnace."; p: [number, number, number] }
  // ---- step 4
  /** Guest: my progress, for the host to keep with the world (every few seconds and on leaving). */
  | { t: "save"; p: PlayerSave }
  /** Host: you killed a mob (for your achievements). */
  | { t: "kill"; type: string; hostile: boolean; weapon: number };

export const encode = (m: Message) => JSON.stringify(m);

/** Parses a message, or null if it is not one of ours. */
export function decode(raw: unknown): Message | null {
  if (typeof raw !== "string" || raw.length > 400_000) return null;
  try {
    const m = JSON.parse(raw);
    return m && typeof m === "object" && typeof m.t === "string" ? (m as Message) : null;
  } catch {
    return null;
  }
}

/** Room codes: 6 letters and digits that can't be confused (no 0/O, 1/I/L). */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newRoomCode(rand: () => number = Math.random) {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return s;
}
export const normalizeRoomCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
export const isRoomCode = (code: string) => /^[A-HJKMNP-Z2-9]{6}$/.test(code);

/** Player names: 1 to 16 plain characters. */
export const cleanName = (name: string) => name.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 16) || "Player";

export function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export const base64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

import { CHUNK_VOLUME } from "../config";
import type { GameMode } from "../player/player";
import type { VitalsData } from "../player/vitals";
import type { SavedStack } from "../items/inventory";
import type { AchievementState } from "../achievements/tracker";
import type { FurnaceState } from "../world/furnaces";

/** Everything about a world except its chunks. */
export interface WorldMeta {
  id: string;
  name: string;
  seed: number;
  seedText: string;
  mode: GameMode;
  created: number;
  lastPlayed: number;
  time: number;
  player: {
    pos: [number, number, number];
    yaw: number;
    pitch: number;
    flying: boolean;
    inventory: SavedStack[];
    selected: number;
    vitals?: VitalsData;
    armor?: SavedStack[];
    xp?: number;
  } | null;
  achievements?: AchievementState;
  /** Furnace contents and fire, by "x,y,z". */
  furnaces?: Record<string, FurnaceState>;
  /** Where the player respawns (set with /spawnpoint). */
  spawnPoint?: [number, number, number];
  /** Commands allowed in this world. */
  cheats?: boolean;
  weather?: { kind: "clear" | "rain" | "thunder"; left: number };
  /** Friends who played here when it was open to them: their progress, by player id. */
  guests?: Record<string, { name: string; player: NonNullable<WorldMeta["player"]>; savedAt: number }>;
  /** Small top-down preview shown in the world list. */
  thumbnail?: string;
}

const DB_NAME = "blockvale";
const DB_VERSION = 2;

/** A saved mob, stored with the chunk it stood in. */
export interface EntityRecord {
  type: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  color: number;
  baby: boolean;
  age: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("worlds")) db.createObjectStore("worlds", { keyPath: "id" });
      if (!db.objectStoreNames.contains("chunks")) db.createObjectStore("chunks");
      // v2: persistent mobs, keyed like chunks. A key with an empty list means
      // "this chunk already had its animals generated".
      if (!db.objectStoreNames.contains("entities")) db.createObjectStore("entities");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const chunkKey = (worldId: string, cx: number, cz: number) => `${worldId}:${cx},${cz}`;
const worldRange = (worldId: string) => IDBKeyRange.bound(`${worldId}:`, `${worldId}:￿`);

/* ------------------------------------------------------- run-length coding */

/** Chunks are long runs of the same block, so (count, id) pairs shrink them ~20x. */
export function rleEncode(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const v = data[i];
    let run = 1;
    while (i + run < data.length && data[i + run] === v && run < 255) run++;
    out.push(run, v);
    i += run;
  }
  return new Uint8Array(out);
}

export function rleDecode(data: Uint8Array): Uint8Array {
  const out = new Uint8Array(CHUNK_VOLUME);
  let o = 0;
  for (let i = 0; i + 1 < data.length; i += 2) {
    out.fill(data[i + 1], o, o + data[i]);
    o += data[i];
  }
  return out;
}

/* ------------------------------------------------------------------ worlds */

export async function listWorlds(): Promise<WorldMeta[]> {
  const db = await open();
  const all = await request(db.transaction("worlds").objectStore("worlds").getAll() as IDBRequest<WorldMeta[]>);
  return all.sort((a, b) => b.lastPlayed - a.lastPlayed);
}

export async function putWorld(meta: WorldMeta): Promise<void> {
  const db = await open();
  const tx = db.transaction("worlds", "readwrite");
  tx.objectStore("worlds").put(meta);
  await done(tx);
}

export async function deleteWorld(id: string): Promise<void> {
  const db = await open();
  const tx = db.transaction(["worlds", "chunks", "entities"], "readwrite");
  tx.objectStore("worlds").delete(id);
  tx.objectStore("chunks").delete(worldRange(id));
  tx.objectStore("entities").delete(worldRange(id));
  await done(tx);
}

/* ------------------------------------------------------------------ chunks */

export async function listChunkKeys(worldId: string): Promise<Set<string>> {
  const db = await open();
  const keys = await request(db.transaction("chunks").objectStore("chunks").getAllKeys(worldRange(worldId)));
  const prefix = worldId.length + 1;
  return new Set(keys.map((k) => String(k).slice(prefix)));
}

export async function loadChunk(worldId: string, cx: number, cz: number): Promise<Uint8Array | null> {
  const db = await open();
  const data = await request(db.transaction("chunks").objectStore("chunks").get(chunkKey(worldId, cx, cz)) as IDBRequest<Uint8Array | undefined>);
  return data ? rleDecode(data) : null;
}

export async function saveChunks(worldId: string, chunks: { cx: number; cz: number; blocks: Uint8Array }[]): Promise<void> {
  if (!chunks.length) return;
  const db = await open();
  const tx = db.transaction("chunks", "readwrite");
  const store = tx.objectStore("chunks");
  for (const c of chunks) store.put(rleEncode(c.blocks), chunkKey(worldId, c.cx, c.cz));
  await done(tx);
}

/* ---------------------------------------------------------------- entities */

export async function listEntityKeys(worldId: string): Promise<Set<string>> {
  const db = await open();
  const keys = await request(db.transaction("entities").objectStore("entities").getAllKeys(worldRange(worldId)));
  const prefix = worldId.length + 1;
  return new Set(keys.map((k) => String(k).slice(prefix)));
}

export async function loadEntities(worldId: string, cx: number, cz: number): Promise<EntityRecord[]> {
  const db = await open();
  const list = await request(db.transaction("entities").objectStore("entities").get(chunkKey(worldId, cx, cz)) as IDBRequest<EntityRecord[] | undefined>);
  return list ?? [];
}

export async function saveEntities(worldId: string, chunks: { cx: number; cz: number; list: EntityRecord[] }[]): Promise<void> {
  if (!chunks.length) return;
  const db = await open();
  const tx = db.transaction("entities", "readwrite");
  const store = tx.objectStore("entities");
  for (const c of chunks) store.put(c.list, chunkKey(worldId, c.cx, c.cz));
  await done(tx);
}

export const newWorldId = () => `w${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;

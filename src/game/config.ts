export const GAME_NAME = "Blockvale";
export const GAME_VERSION = "0.1.0";

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 128;
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
export const CHUNK_VOLUME = CHUNK_AREA * CHUNK_HEIGHT;
export const SEA_LEVEL = 48;

/** Ticks per in-game day, matching the classic 20-minute day at 20 ticks/s. */
export const DAY_TICKS = 24000;
export const TICKS_PER_SECOND = 20;

export const AUTOSAVE_INTERVAL_MS = 30_000;

/** Index into a chunk's block array: y-major so a vertical column is strided by CHUNK_AREA. */
export const blockIndex = (x: number, y: number, z: number) => x + z * CHUNK_SIZE + y * CHUNK_AREA;

export const chunkKey = (cx: number, cz: number) => `${cx},${cz}`;

import type { World } from "../world/world";
import type { Weather } from "../world/weather";
import type { EntityManager } from "../entities/entityManager";
import type { DropManager } from "../entities/drops";
import type { XpOrbManager } from "../entities/xpOrbs";
import type { ProjectileManager } from "../entities/projectiles";
import type { FurnaceRegistry, FurnaceState } from "../world/furnaces";
import type { Mob } from "../entities/mob";
import type { NetPlayerState, PlayerSave } from "./protocol";

/** What the networking needs from the running game (the session implements it). */
export interface NetGame {
  readonly world: World;
  readonly weather: Weather;
  readonly entities: EntityManager;
  readonly drops: DropManager;
  readonly xpOrbs: XpOrbManager;
  readonly projectiles: ProjectileManager;
  readonly furnaces: FurnaceRegistry;
  time: number;
  playerState(): NetPlayerState;
  worldInfo(): { name: string; seed: number; mode: "survival" | "creative" };
  spawn(): [number, number, number];
  /** Chunks changed since generation ("cx,cz"). */
  modifiedChunks(): string[];
  /** A changed chunk's blocks, from memory or the save, or null. */
  chunkData(cx: number, cz: number): Promise<Uint8Array | null>;
  /** Applies block changes that came over the network. */
  applyEdits(c: number[]): void;

  // Host: things guests ask for.
  /** A guest fed one of our mobs: does it take the food? */
  feedFromGuest(mob: Mob, item: number): boolean;
  /** Keep a friend's progress with the world, and find it again when they come back. */
  saveGuest(id: string, name: string, p: PlayerSave): void;
  guestSave(id: string, name: string): PlayerSave | null;

  /** Our own progress, for the host to keep. */
  playerSave(): PlayerSave;
  /** The host credits us with a kill. */
  creditKill(type: string, hostile: boolean, weapon: number): void;

  // Guest: things the host tells us.
  hurtPlayer(amount: number, cause: "mob" | "arrow", fromX: number, fromZ: number): void;
  receiveItem(item: number, count: number, wear?: number): void;
  receiveXp(points: number): void;
  /** The host says the mob took our food: use one up. */
  fedConfirmed(item: number): void;
  /** Fresh contents for the furnace we have open. */
  furnaceUpdate(p: [number, number, number], f: FurnaceState): void;
}

import type { DamageCause } from "./player/vitals";

/** Everything gameplay systems (achievements today, maybe stats later) can listen to. */
export interface GameEvents {
  joined: Record<string, never>;
  blockBroken: { id: number; x: number; y: number; z: number; harvested: boolean; tool: number };
  blockPlaced: { id: number; x: number; y: number; z: number };
  itemCrafted: { id: number; count: number };
  itemPickedUp: { id: number; count: number };
  itemEaten: { id: number };
  enterWater: Record<string, never>;
  dayPassed: { day: number };
  /** Sampled about once a second. */
  position: { x: number; y: number; z: number };
  attack: { weapon: number; damage: number; target: string };
  mobKilled: { type: string; hostile: boolean; weapon: number; byPlayer: boolean };
  /** Three or more sheep within 16 blocks. */
  flockSeen: { count: number };
  /** Sunrise reached in Survival without dying since the last one. */
  nightSurvived: { day: number };
  died: { cause: DamageCause | null };
  respawned: Record<string, never>;
}

type Handler<T> = (payload: T) => void;

/** Minimal typed pub/sub. */
export class EventBus<E extends object = GameEvents> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(type: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof E>(type: K, payload: E[K]) {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const fn of set) (fn as Handler<E[K]>)(payload);
  }

  clear() {
    this.handlers.clear();
  }
}

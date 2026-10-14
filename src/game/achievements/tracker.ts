import type { EventBus, GameEvents } from "../events";
import { getItem } from "../world/blocks";
import { ACHIEVEMENTS, requiredCount, type AchievementDef, type Trigger } from "./achievements";

/** Persisted per world, inside the world's save. */
export interface AchievementState {
  unlocked: Record<string, number>;
  progress: Record<string, number>;
}

export const emptyAchievementState = (): AchievementState => ({ unlocked: {}, progress: {} });

export type NodeStatus = "unlocked" | "available" | "locked";

export function statusOf(def: AchievementDef, state: AchievementState): NodeStatus {
  if (state.unlocked[def.id]) return "unlocked";
  if (!def.parentId || state.unlocked[def.parentId]) return "available";
  return "locked";
}

const matches = (ids: number[] | undefined, id: number) => !ids || ids.includes(id);

/**
 * Listens to game events and advances matching achievements. Children can be
 * earned before their parent (the tree is a guide, not a gate), but they
 * only show as "available" once the parent is done.
 */
export class AchievementTracker {
  private unsubs: (() => void)[] = [];

  constructor(
    readonly state: AchievementState,
    bus: EventBus<GameEvents>,
    private onUnlock: (def: AchievementDef) => void,
  ) {
    const on = <K extends keyof GameEvents>(type: K, fn: (p: GameEvents[K]) => void) => this.unsubs.push(bus.on(type, fn));
    on("joined", () => this.advance((t) => t.type === "joined"));
    on("blockBroken", (e) => this.advance((t) => t.type === "break" && matches(t.ids, e.id) && (!t.harvested || e.harvested)));
    on("blockPlaced", (e) => this.advance((t) => t.type === "place" && matches(t.ids, e.id)));
    on("itemCrafted", (e) => this.advance((t) => t.type === "craft" && matches(t.ids, e.id), e.count));
    on("itemPickedUp", (e) => this.advance((t) => t.type === "pickup" && matches(t.ids, e.id), e.count));
    on("itemEaten", (e) => this.advance((t) => t.type === "eat" && matches(t.ids, e.id)));
    on("enterWater", () => this.advance((t) => t.type === "water"));
    on("dayPassed", () => this.advance((t) => t.type === "day"));
    on("respawned", () => this.advance((t) => t.type === "respawn"));
    on("mobKilled", (e) =>
      this.advance((t) => t.type === "kill" && e.byPlayer && (t.hostile === undefined || t.hostile === e.hostile) && (!t.weaponTool || getItem(e.weapon)?.tool?.type === t.weaponTool)),
    );
    on("flockSeen", () => this.advance((t) => t.type === "flock"));
    on("nightSurvived", () => this.advance((t) => t.type === "nightSurvived"));
    on("position", (e) =>
      this.advance((t) => (t.type === "above" && e.y >= t.y) || (t.type === "below" && e.y < t.y)),
    );
  }

  /** Craft counts are "times crafted", not items produced. */
  private advance(test: (t: Trigger) => boolean, amount = 1) {
    for (const def of ACHIEVEMENTS) {
      if (this.state.unlocked[def.id] || !test(def.trigger)) continue;
      const need = requiredCount(def);
      const counted = def.trigger.type === "craft" || def.trigger.type === "pickup" ? 1 : amount;
      const progress = Math.min(need, (this.state.progress[def.id] ?? 0) + counted);
      this.state.progress[def.id] = progress;
      if (progress >= need) {
        this.state.unlocked[def.id] = Date.now();
        delete this.state.progress[def.id];
        this.onUnlock(def);
      }
    }
  }

  dispose() {
    for (const u of this.unsubs) u();
    this.unsubs = [];
  }
}

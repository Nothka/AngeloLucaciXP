import type { SavedStack } from "../items/inventory";
import type { WorldMeta } from "./db";

/**
 * Cloud copy of the player (inventory, armor, XP, health, position) for each
 * world, in Firestore under blockvale/{uid}/worlds/{worldId}. Each browser
 * signs in anonymously, so the rules can keep every player to their own
 * documents. Worlds themselves (chunks) stay in the browser: they are far
 * too large for Firestore documents.
 */

export type PlayerSave = NonNullable<WorldMeta["player"]>;

/** Firestore cannot store arrays inside arrays, so stacks become small maps. */
export interface CloudStack {
  id: number;
  count: number;
  wear?: number;
}

export interface CloudDoc {
  name: string;
  seed: number;
  mode: string;
  /** Client clock when this copy was made (ms); the newer copy wins. */
  savedAt: number;
  player: {
    pos: { x: number; y: number; z: number };
    yaw: number;
    pitch: number;
    flying: boolean;
    selected: number;
    inventory: (CloudStack | null)[];
    armor: (CloudStack | null)[];
    xp: number;
    vitals: { health: number; food: number; saturation: number; air: number } | null;
  };
}

const toCloudStack = (s: SavedStack): CloudStack | null => {
  if (!s) return null;
  return s.length === 3 && s[2] ? { id: s[0], count: s[1], wear: s[2] } : { id: s[0], count: s[1] };
};

const fromCloudStack = (s: unknown): SavedStack => {
  if (!s || typeof s !== "object") return null;
  const { id, count, wear } = s as Partial<CloudStack>;
  if (!Number.isInteger(id) || !Number.isInteger(count) || count! <= 0 || count! > 64) return null;
  return Number.isFinite(wear) && wear! > 0 ? [id!, count!, wear!] : [id!, count!];
};

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

export function toCloud(meta: WorldMeta, savedAt: number): CloudDoc | null {
  const p = meta.player;
  if (!p) return null;
  return {
    name: meta.name.slice(0, 64),
    seed: meta.seed,
    mode: meta.mode,
    savedAt,
    player: {
      pos: { x: p.pos[0], y: p.pos[1], z: p.pos[2] },
      yaw: p.yaw,
      pitch: p.pitch,
      flying: p.flying,
      selected: p.selected,
      inventory: p.inventory.map(toCloudStack),
      armor: (p.armor ?? []).map(toCloudStack),
      xp: p.xp ?? 0,
      vitals: p.vitals ? { ...p.vitals } : null,
    },
  };
}

/** Reads a cloud copy back, tolerating missing or malformed fields. */
export function fromCloud(doc: unknown): { player: PlayerSave; savedAt: number } | null {
  if (!doc || typeof doc !== "object") return null;
  const d = doc as Partial<CloudDoc>;
  const p = d.player;
  if (!p || typeof p !== "object" || !p.pos || !Array.isArray(p.inventory)) return null;
  const vitals = p.vitals && typeof p.vitals === "object"
    ? { health: num(p.vitals.health, 20), food: num(p.vitals.food, 20), saturation: num(p.vitals.saturation, 5), air: num(p.vitals.air, 300) }
    : undefined;
  return {
    savedAt: num(d.savedAt),
    player: {
      pos: [num(p.pos.x), num(p.pos.y, 80), num(p.pos.z)],
      yaw: num(p.yaw),
      pitch: num(p.pitch),
      flying: p.flying === true,
      selected: Math.max(0, Math.min(8, Math.floor(num(p.selected)))),
      inventory: p.inventory.slice(0, 36).map(fromCloudStack),
      armor: Array.isArray(p.armor) ? p.armor.slice(0, 4).map(fromCloudStack) : undefined,
      xp: Math.max(0, Math.floor(num(p.xp))),
      vitals,
    },
  };
}

/** Picks the player to load: the cloud copy only when it is newer than the local save. */
export function choosePlayer(local: WorldMeta, cloud: { player: PlayerSave; savedAt: number } | null): PlayerSave | null {
  if (!cloud) return local.player;
  if (!local.player) return cloud.player;
  return cloud.savedAt > local.lastPlayed ? cloud.player : local.player;
}

export type CloudState = "off" | "connecting" | "ready" | "error";

type FirestoreApi = typeof import("firebase/firestore");

/** Minimum seconds between uploads (autosaves come every 30 s; pausing and quitting force one). */
const MIN_INTERVAL_MS = 20_000;

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
} as Record<string, string | undefined>;

class CloudSave {
  state: CloudState = "off";
  /** Why it is off or failing, for the pause menu. */
  message = "";
  lastSync = 0;
  private ready: Promise<{ fs: FirestoreApi; db: import("firebase/firestore").Firestore; uid: string } | null> | null = null;
  private lastPushed = new Map<string, { at: number; body: string }>();

  get configured() {
    return Object.values(config).every((v) => typeof v === "string" && v.trim().length > 0);
  }

  /** Signs in anonymously the first time it is needed; resolves to null when the cloud is unavailable. Shared with multiplayer. */
  connect() {
    this.ready ??= (async () => {
      if (!this.configured) {
        this.message = "Firebase is not configured";
        return null;
      }
      this.state = "connecting";
      try {
        const [{ getApp, getApps, initializeApp }, auth, fs] = await Promise.all([
          import("firebase/app"), import("firebase/auth"), import("firebase/firestore"),
        ]);
        const app = getApps().length ? getApp() : initializeApp(config);
        const a = auth.getAuth(app);
        const user = a.currentUser ?? (await auth.signInAnonymously(a)).user;
        this.state = "ready";
        this.message = "";
        return { fs, db: fs.getFirestore(app), uid: user.uid };
      } catch (err) {
        this.state = "error";
        const code = (err as { code?: string }).code ?? "";
        this.message = code === "auth/operation-not-allowed" || code === "auth/admin-restricted-operation"
          ? "Anonymous sign-in is turned off in Firebase"
          : code.startsWith("auth/api-key-not-valid")
            ? "the API key is not allowed to use Firebase sign-in"
            : "Could not reach the cloud";
        console.warn("[blockvale] cloud save unavailable:", code || err);
        return null;
      }
    })();
    return this.ready;
  }

  private ref(c: NonNullable<Awaited<ReturnType<CloudSave["connect"]>>>, worldId: string) {
    return c.fs.doc(c.db, "blockvale", c.uid, "worlds", worldId);
  }

  /** The cloud copy for a world, or null (also after `timeoutMs`, so a slow network never blocks loading). */
  async pull(worldId: string, timeoutMs = 3000) {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
    const read = (async () => {
      const c = await this.connect();
      if (!c) return null;
      const snap = await c.fs.getDoc(this.ref(c, worldId));
      return snap.exists() ? fromCloud(snap.data()) : null;
    })().catch((err) => {
      this.state = "error";
      this.message = "Could not read the cloud save";
      console.warn("[blockvale] cloud read failed:", err);
      return null;
    });
    return Promise.race([read, timeout]);
  }

  /** Uploads the player for this world unless nothing changed or the last upload was moments ago. */
  async push(meta: WorldMeta, force = false) {
    const body = toCloud(meta, meta.lastPlayed);
    if (!body) return;
    const json = JSON.stringify({ ...body, savedAt: 0 });
    const prev = this.lastPushed.get(meta.id);
    if (prev && (prev.body === json || (!force && Date.now() - prev.at < MIN_INTERVAL_MS))) return;
    const c = await this.connect();
    if (!c) return;
    try {
      await c.fs.setDoc(this.ref(c, meta.id), body);
      this.lastPushed.set(meta.id, { at: Date.now(), body: json });
      this.lastSync = Date.now();
      this.state = "ready";
      this.message = "";
    } catch (err) {
      this.state = "error";
      this.message = "Could not save to the cloud";
      console.warn("[blockvale] cloud save failed:", err);
    }
  }

  async remove(worldId: string) {
    const c = await this.connect();
    if (!c) return;
    await c.fs.deleteDoc(this.ref(c, worldId)).catch(() => {});
    this.lastPushed.delete(worldId);
  }

  /** One line for the pause menu. */
  describe(): string {
    if (this.state === "ready") {
      return this.lastSync ? `Cloud save: synced at ${new Date(this.lastSync).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Cloud save: on";
    }
    if (this.state === "connecting") return "Cloud save: connecting...";
    return this.message ? `Cloud save: off (${this.message})` : "Cloud save: off";
  }
}

export const cloudSave = new CloudSave();

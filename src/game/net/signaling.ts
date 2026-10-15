import { cloudSave } from "../save/cloud";

/**
 * Matchmaking: before two browsers can talk directly, they swap one offer
 * and one answer. The host publishes a room under a code; a joining player
 * posts their offer to it; the host posts back an answer (or a refusal).
 */

export interface RoomInfo {
  name: string;
  seed: number;
  version: number;
}

export interface JoinRequest {
  id: string;
  name: string;
  offer: string;
}

export interface Signaling {
  /** Who we are to the matchmaker. */
  readonly selfId: string;
  openRoom(code: string, info: RoomInfo, onRequest: (r: JoinRequest) => void): Promise<void>;
  answer(code: string, requestId: string, reply: { answer: string } | { error: string }): Promise<void>;
  /** Forget a handled request. */
  done(code: string, requestId: string): Promise<void>;
  closeRoom(code: string): Promise<void>;
  getRoom(code: string): Promise<RoomInfo | null>;
  /** Posts an offer and waits for the host's reply. */
  requestJoin(code: string, name: string, offer: string, timeoutMs?: number): Promise<{ answer: string } | { error: string }>;
}

/* ------------------------------------------------------------ Firestore */

class FirestoreSignaling implements Signaling {
  private unsub = new Map<string, () => void>();

  private constructor(private c: NonNullable<Awaited<ReturnType<typeof cloudSave.connect>>>) {}

  static async create(): Promise<FirestoreSignaling | null> {
    const c = await cloudSave.connect();
    return c ? new FirestoreSignaling(c) : null;
  }

  get selfId() {
    return this.c.uid;
  }

  private room(code: string) {
    return this.c.fs.doc(this.c.db, "rooms", code);
  }

  private join(code: string, id: string) {
    return this.c.fs.doc(this.c.db, "rooms", code, "joins", id);
  }

  async openRoom(code: string, info: RoomInfo, onRequest: (r: JoinRequest) => void) {
    const fs = this.c.fs;
    await fs.setDoc(this.room(code), { host: this.c.uid, name: info.name.slice(0, 64), seed: info.seed, version: info.version, createdAt: fs.serverTimestamp() });
    const seen = new Set<string>();
    const unsub = fs.onSnapshot(fs.collection(this.c.db, "rooms", code, "joins"), (snap) => {
      for (const d of snap.docs) {
        const data = d.data();
        if (seen.has(d.id) || data.answer || data.error || typeof data.offer !== "string") continue;
        seen.add(d.id);
        onRequest({ id: d.id, name: String(data.name ?? "Player"), offer: data.offer });
      }
    }, (err) => console.warn("[blockvale] room listener failed:", err));
    this.unsub.set(code, unsub);
  }

  async answer(code: string, requestId: string, reply: { answer: string } | { error: string }) {
    await this.c.fs.updateDoc(this.join(code, requestId), reply);
  }

  async done(code: string, requestId: string) {
    await this.c.fs.deleteDoc(this.join(code, requestId)).catch(() => {});
  }

  async closeRoom(code: string) {
    this.unsub.get(code)?.();
    this.unsub.delete(code);
    await this.c.fs.deleteDoc(this.room(code)).catch(() => {});
  }

  async getRoom(code: string) {
    const snap = await this.c.fs.getDoc(this.room(code)).catch(() => null);
    if (!snap?.exists()) return null;
    const d = snap.data();
    return { name: String(d.name ?? "World"), seed: Number(d.seed), version: Number(d.version) };
  }

  async requestJoin(code: string, name: string, offer: string, timeoutMs = 20000) {
    const fs = this.c.fs;
    const ref = this.join(code, this.c.uid);
    await fs.setDoc(ref, { name: name.slice(0, 24), offer, createdAt: fs.serverTimestamp() });
    return new Promise<{ answer: string } | { error: string }>((resolve) => {
      const timer = setTimeout(() => {
        unsub();
        resolve({ error: "The host didn't answer. Check the code, and that their world is still open." });
      }, timeoutMs);
      const unsub = fs.onSnapshot(ref, (snap) => {
        const d = snap.data();
        if (!d || (!d.answer && !d.error)) return;
        clearTimeout(timer);
        unsub();
        resolve(d.answer ? { answer: d.answer } : { error: String(d.error) });
      }, () => {});
    });
  }
}

/* ------------------------------------------------------------ same-browser (development and tests) */

type LocalMsg =
  | { k: "room?"; code: string; from: string }
  | { k: "room"; code: string; to: string; info: RoomInfo | null }
  | { k: "join"; code: string; from: string; name: string; offer: string }
  | { k: "reply"; to: string; reply: { answer: string } | { error: string } };

/** Matchmaking between tabs of the same browser over a BroadcastChannel; nothing leaves the machine. */
class LocalSignaling implements Signaling {
  readonly selfId = `local-${Math.random().toString(36).slice(2, 10)}`;
  private bc = new BroadcastChannel("blockvale-signaling");
  private rooms = new Map<string, { info: RoomInfo; onRequest: (r: JoinRequest) => void }>();
  private waiting = new Map<string, (m: LocalMsg) => void>();

  constructor() {
    this.bc.onmessage = (e) => {
      const m = e.data as LocalMsg;
      if (m.k === "room?" && this.rooms.has(m.code)) this.bc.postMessage({ k: "room", code: m.code, to: m.from, info: this.rooms.get(m.code)!.info } satisfies LocalMsg);
      else if (m.k === "join") this.rooms.get(m.code)?.onRequest({ id: m.from, name: m.name, offer: m.offer });
      else if ((m.k === "room" || m.k === "reply") && m.to === this.selfId) this.waiting.get(m.k)?.(m);
    };
  }

  async openRoom(code: string, info: RoomInfo, onRequest: (r: JoinRequest) => void) {
    this.rooms.set(code, { info, onRequest });
  }

  async answer(_code: string, requestId: string, reply: { answer: string } | { error: string }) {
    this.bc.postMessage({ k: "reply", to: requestId, reply } satisfies LocalMsg);
  }

  async done() {}

  async closeRoom(code: string) {
    this.rooms.delete(code);
  }

  private wait<T extends LocalMsg>(kind: T["k"], timeoutMs: number): Promise<T | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiting.delete(kind);
        resolve(null);
      }, timeoutMs);
      this.waiting.set(kind, (m) => {
        clearTimeout(timer);
        this.waiting.delete(kind);
        resolve(m as T);
      });
    });
  }

  async getRoom(code: string) {
    const reply = this.wait<Extract<LocalMsg, { k: "room" }>>("room", 1500);
    this.bc.postMessage({ k: "room?", code, from: this.selfId } satisfies LocalMsg);
    return (await reply)?.info ?? null;
  }

  async requestJoin(code: string, name: string, offer: string, timeoutMs = 20000) {
    const reply = this.wait<Extract<LocalMsg, { k: "reply" }>>("reply", timeoutMs);
    this.bc.postMessage({ k: "join", code, from: this.selfId, name, offer } satisfies LocalMsg);
    return (await reply)?.reply ?? { error: "The host didn't answer" };
  }
}

/**
 * Firestore when Firebase is set up (the real thing, across the internet);
 * same-browser tabs when it isn't, or with ?localnet in the address (testing).
 */
export async function createSignaling(): Promise<Signaling | null> {
  if (new URLSearchParams(location.search).has("localnet")) return new LocalSignaling();
  const fs = await FirestoreSignaling.create();
  if (fs) return fs;
  return import.meta.env.DEV ? new LocalSignaling() : null;
}

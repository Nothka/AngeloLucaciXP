import { rleDecode } from "../save/db";
import type { Chunk } from "../world/chunk";
import type { ChunkStore } from "../world/world";
import type { NetGame } from "./game";
import { Peer } from "./peer";
import { PROTOCOL_VERSION, STATE_HZ, base64ToBytes, cleanName, isRoomCode, normalizeRoomCode, type Message, type Welcome } from "./protocol";
import { RemotePlayers } from "./remotePlayers";
import { THROWN_ITEMS } from "../entities/projectiles";
import * as THREE from "three";
import type { FurnaceState } from "../world/furnaces";
import { createSignaling } from "./signaling";

/**
 * Chunks for a joined world: unchanged ones are generated from the seed as
 * usual; changed ones come from the host. Nothing is saved here - the host
 * keeps the world.
 */
class RemoteChunkStore implements ChunkStore {
  readonly modified: Set<string>;
  private waiting = new Map<string, (b: Uint8Array | null) => void>();

  constructor(modified: string[], private ask: (cx: number, cz: number) => void) {
    this.modified = new Set(modified);
  }

  has(cx: number, cz: number) {
    return this.modified.has(`${cx},${cz}`);
  }

  load(cx: number, cz: number): Promise<Uint8Array | null> {
    const key = `${cx},${cz}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.waiting.delete(key);
        resolve(null);
      }, 10000);
      this.waiting.set(key, (b) => {
        clearTimeout(timer);
        resolve(b);
      });
      this.ask(cx, cz);
    });
  }

  arrived(cx: number, cz: number, data: Uint8Array | null) {
    const key = `${cx},${cz}`;
    this.waiting.get(key)?.(data);
    this.waiting.delete(key);
  }

  save(_chunk: Chunk) {}
}

/** A joined world: our player's moves and edits go to the host; the world's changes come back. */
export class GuestNet {
  readonly remotes = new RemotePlayers();
  readonly store: RemoteChunkStore;
  private game: NetGame | null = null;
  private stateTimer = 0;
  private saveTimer = 0;
  private edits: number[] = [];
  /** Changes for chunks we haven't loaded yet: applied when they arrive. */
  private pending = new Map<string, number[]>();
  /** True while applying the host's changes (they must not be sent back). */
  applying = false;
  onChat: ((name: string, text: string) => void) | null = null;
  onInfo: ((text: string) => void) | null = null;
  /** The link to the host went down; `unexpected` when the host didn't say goodbye (worth reconnecting). */
  onClosed: ((reason: string, unexpected: boolean) => void) | null = null;
  private closedReason: string | null = null;

  private constructor(readonly code: string, private peer: Peer, readonly welcome: Welcome, readonly selfName: string) {
    this.store = new RemoteChunkStore(welcome.modified, (cx, cz) => peer.send({ t: "chunk?", cx, cz }));
    for (const p of welcome.players) this.remotes.add(p.id, p.name);
    peer.onMessage = (m) => this.receive(m);
    peer.onClose = () => this.onClosed?.(this.closedReason ?? "Lost the connection to the host", this.closedReason === null);
  }

  /** Finds the room, connects to its host and waits to be let in. */
  static async join(codeText: string, name: string): Promise<GuestNet> {
    const code = normalizeRoomCode(codeText);
    if (!isRoomCode(code)) throw new Error("A room code is 6 letters and numbers");
    const sig = await createSignaling();
    if (!sig) throw new Error("Multiplayer needs the cloud connection (Firebase), which is not available");
    const room = await sig.getRoom(code);
    if (!room) throw new Error(`No open world with the code ${code}`);
    if (room.version !== PROTOCOL_VERSION) throw new Error("That world is on a different version of the game. Both of you should reload the page.");
    const offer = await Peer.offer();
    const reply = await sig.requestJoin(code, cleanName(name), offer.sdp);
    if ("error" in reply) throw new Error(reply.error);
    const peer = await offer.connect(reply.answer);
    const welcome = await new Promise<Welcome>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("The host didn't let us in")), 15000);
      peer.onMessage = (m) => {
        if (m.t === "welcome") {
          clearTimeout(timer);
          resolve(m);
        } else if (m.t === "refused") {
          clearTimeout(timer);
          reject(new Error(m.reason));
        }
      };
      peer.send({ t: "hello", name: cleanName(name), version: PROTOCOL_VERSION });
    });
    return new GuestNet(code, peer, welcome, cleanName(name));
  }

  attach(game: NetGame) {
    this.game = game;
  }

  private receive(m: Message) {
    switch (m.t) {
      case "p":
        this.remotes.state(m.id, m.s);
        break;
      case "join":
        this.remotes.add(m.id, m.name);
        this.onInfo?.(`${m.name} joined the game`);
        break;
      case "leave": {
        const name = this.remotes.nameOf(m.id);
        this.remotes.remove(m.id);
        if (name) this.onInfo?.(`${name} left the game`);
        break;
      }
      case "set":
        if (Array.isArray(m.c)) this.apply(m.c);
        break;
      case "chunk":
        this.store.arrived(m.cx, m.cz, m.data ? rleDecode(base64ToBytes(m.data)) : null);
        break;
      case "chat":
        this.onChat?.(this.remotes.nameOf(m.id) ?? "Someone", m.text);
        break;
      case "sky":
        if (this.game) {
          this.game.time = m.time;
          if (this.game.weather.kind !== m.weather.kind) this.game.weather.set(m.weather.kind, m.weather.left);
          else this.game.weather.left = m.weather.left;
        }
        break;
      case "bye":
        this.closedReason = m.reason;
        break;
      // ---- the host's mobs, items, experience, arrows and furnaces
      case "mobs":
        this.game?.entities.applySnapshot(m.m);
        break;
      case "hurt":
        this.game?.hurtPlayer(m.amount, m.cause, m.fx, m.fz);
        break;
      case "fed":
        this.game?.fedConfirmed(m.item);
        break;
      case "drops":
        for (const d of m.d) this.game?.drops.mirror(d);
        break;
      case "drop-":
        for (const id of m.ids) this.game?.drops.forget(id);
        break;
      case "drop~":
        this.game?.drops.recount(m.id, m.count);
        break;
      case "give":
        this.game?.receiveItem(m.item, m.count, m.wear || undefined);
        break;
      case "orbs":
        for (const o of m.o) this.game?.xpOrbs.mirrorOrb(o);
        break;
      case "orb-":
        for (const id of m.ids) this.game?.xpOrbs.forget(id);
        break;
      case "xp":
        this.game?.receiveXp(m.v);
        break;
      case "arrow": {
        const [x, y, z, vx, vy, vz] = m.a;
        const item = THROWN_ITEMS.has(m.item ?? 0) ? m.item : undefined;
        this.game?.projectiles.shoot(new THREE.Vector3(x, y, z), new THREE.Vector3(vx, vy, vz), { fromPlayer: true, shooter: null, damage: 0, pickup: false, item });
        break;
      }
      case "furnace":
        this.game?.furnaceUpdate(m.p, m.f);
        break;
      case "kill":
        this.game?.creditKill(m.type, m.hostile, m.weapon);
        break;
    }
  }

  /* ---- our player's actions that the host's world decides */

  hit(mob: number, damage: number, weapon: number, fromX: number, fromZ: number) {
    this.peer.send({ t: "hit", mob, damage, weapon, fx: fromX, fz: fromZ });
  }

  feed(mob: number, item: number) {
    this.peer.send({ t: "feed", mob, item });
  }

  pick(dropId: number) {
    this.peer.send({ t: "pick", id: dropId });
  }

  throwItem(item: number, count: number, x: number, y: number, z: number, vel: THREE.Vector3 | undefined, delay: number, wear?: number) {
    const r = (v: number) => Math.round(v * 100) / 100;
    this.peer.send({ t: "throw", item, count, wear: wear ?? 0, p: [r(x), r(y), r(z)], v: vel ? [r(vel.x), r(vel.y), r(vel.z)] : null, delay });
  }

  orb(points: number, x: number, y: number, z: number) {
    this.peer.send({ t: "orb", v: points, p: [x, y, z] });
  }

  shoot(from: THREE.Vector3, vel: THREE.Vector3, damage: number, pickup: boolean, item = 0) {
    this.peer.send({ t: "shoot", a: [from.x, from.y, from.z, vel.x, vel.y, vel.z], damage, pickup, item });
  }

  furnaceOpen(p: [number, number, number]) {
    this.peer.send({ t: "furnace?", p });
  }

  furnaceChanged(p: [number, number, number], f: FurnaceState) {
    this.peer.send({ t: "furnace=", p, f });
  }

  furnaceClosed(p: [number, number, number]) {
    this.peer.send({ t: "furnace.", p });
  }

  private apply(c: number[]) {
    const g = this.game;
    if (!g) return;
    const ready: number[] = [];
    for (let i = 0; i + 3 < c.length; i += 4) {
      const [x, y, z, id] = [c[i], c[i + 1], c[i + 2], c[i + 3]];
      const key = `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
      this.store.modified.add(key);
      if (g.world.isLoaded(x, z)) ready.push(x, y, z, id);
      else {
        const list = this.pending.get(key) ?? [];
        list.push(x, y, z, id);
        this.pending.set(key, list);
      }
    }
    if (!ready.length) return;
    this.applying = true;
    try {
      g.applyEdits(ready);
    } finally {
      this.applying = false;
    }
  }

  /** A chunk finished loading here: catch up on changes that arrived before it. */
  chunkLoaded(cx: number, cz: number) {
    const key = `${cx},${cz}`;
    const list = this.pending.get(key);
    if (!list) return;
    this.pending.delete(key);
    this.apply(list);
  }

  /** Our own edit: tell the host (batched per frame). */
  blockChanged(x: number, y: number, z: number, id: number) {
    this.edits.push(x, y, z, id);
  }

  update(dt: number, lightAt: (x: number, y: number, z: number) => number, daylight: number) {
    if (this.edits.length) {
      this.peer.send({ t: "set", c: this.edits.splice(0, 4000) });
    }
    this.stateTimer += dt;
    if (this.stateTimer >= 1 / STATE_HZ && this.game) {
      this.stateTimer = 0;
      this.peer.send({ t: "p", id: "", s: this.game.playerState() });
    }
    // Our progress lives with the host's world: keep it up to date there.
    this.saveTimer += dt;
    if (this.saveTimer >= 10 && this.game) {
      this.saveTimer = 0;
      this.peer.send({ t: "save", p: this.game.playerSave() });
    }
    this.remotes.update(dt, lightAt, daylight);
  }

  chat(text: string) {
    this.peer.send({ t: "chat", id: "", text: text.slice(0, 256) });
  }

  /** Leaves: sends our progress one last time, gives it a moment to go out, then hangs up. */
  async close() {
    this.onClosed = null;
    if (this.game && this.peer.open) {
      this.peer.send({ t: "save", p: this.game.playerSave() });
      await new Promise((r) => setTimeout(r, 200));
    }
    this.peer.close();
    this.remotes.clear();
  }
}

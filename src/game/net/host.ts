import { rleEncode } from "../save/db";
import type { NetGame } from "./game";
import { Peer } from "./peer";
import { MAX_PLAYERS, MOB_RANGE, PROTOCOL_VERSION, STATE_HZ, bytesToBase64, cleanName, newRoomCode, type Message, type NetPlayerState } from "./protocol";
import type { DropNet } from "../entities/drops";
import type { OrbNet } from "../entities/xpOrbs";
import * as THREE from "three";
import { RemotePlayers } from "./remotePlayers";
import { THROWN_ITEMS } from "../entities/projectiles";
import { createSignaling, type JoinRequest, type Signaling } from "./signaling";

interface Guest {
  id: string;
  name: string;
  peer: Peer;
  welcomed: boolean;
  /** Last known state, so the host keeps the world around them loaded and mobs can find them. */
  x: number;
  y: number;
  z: number;
  state: NetPlayerState | null;
  /** The furnace they have open ("x,y,z"), to keep them up to date with it. */
  furnace: [number, number, number] | null;
}

/**
 * Hosting: the world on this machine is the real one. Players join with
 * the room code; their block changes are applied here, and everything that
 * happens to the world (theirs, ours, water, redstone) goes out to all.
 */
export class HostNet {
  readonly remotes = new RemotePlayers();
  private guests = new Map<string, Guest>();
  private edits: number[] = [];
  private modified = new Set<string>();
  private stateTimer = 0;
  private skyTimer = 0;
  private mobTimer = 0;
  private furnaceTimer = 0;
  private dropsNew: DropNet[] = [];
  private dropsGone: number[] = [];
  private orbsNew: OrbNet[] = [];
  private orbsGone: number[] = [];
  /** The guest whose bow shot we are making right now (they already see their own arrow). */
  private shooter: Guest | null = null;
  private closed = false;
  /** Chat lines and notices for the chat box. */
  onChat: ((name: string, text: string) => void) | null = null;
  onInfo: ((text: string) => void) | null = null;
  /** True while applying a guest's edits (they are already counted). */
  applying = false;

  private constructor(readonly code: string, private game: NetGame, private sig: Signaling, readonly selfName: string) {
    for (const k of game.modifiedChunks()) this.modified.add(k);
  }

  /** Opens the world to friends: publishes a room and starts answering join requests. */
  static async open(game: NetGame, hostName: string): Promise<HostNet> {
    const sig = await createSignaling();
    if (!sig) throw new Error("Multiplayer needs the cloud connection (Firebase), which is not available");
    const code = newRoomCode();
    const host = new HostNet(code, game, sig, cleanName(hostName));
    const info = game.worldInfo();
    await sig.openRoom(code, { name: info.name, seed: info.seed, version: PROTOCOL_VERSION }, (r) => void host.request(r));
    return host;
  }

  get playerCount() {
    return 1 + [...this.guests.values()].filter((g) => g.welcomed).length;
  }

  get names() {
    return [this.selfName, ...[...this.guests.values()].filter((g) => g.welcomed).map((g) => g.name)];
  }

  private async request(r: JoinRequest) {
    if (this.closed) return;
    if (this.playerCount + this.pendingJoins >= MAX_PLAYERS) {
      await this.sig.answer(this.code, r.id, { error: `This world is full (${MAX_PLAYERS} players)` }).catch(() => {});
      return;
    }
    this.pendingJoins++;
    try {
      const { sdp, peer } = await Peer.answer(r.offer);
      await this.sig.answer(this.code, r.id, { answer: sdp });
      const p = await peer;
      void this.sig.done(this.code, r.id);
      this.attach(r.id, cleanName(r.name), p);
    } catch (err) {
      console.warn("[blockvale] a player could not connect:", err);
    } finally {
      this.pendingJoins--;
    }
  }
  private pendingJoins = 0;

  private attach(id: string, name: string, peer: Peer) {
    // Same browser joining again: replace the old connection.
    this.guests.get(id)?.peer.close();
    const guest: Guest = { id, name, peer, welcomed: false, x: 0, y: 0, z: 0, state: null, furnace: null };
    this.guests.set(id, guest);
    peer.onMessage = (m) => this.receive(guest, m);
    peer.onClose = () => this.drop(guest);
  }

  private drop(g: Guest) {
    if (this.guests.get(g.id) !== g) return;
    this.guests.delete(g.id);
    this.remotes.remove(g.id);
    if (g.welcomed) {
      this.broadcast({ t: "leave", id: g.id });
      this.onInfo?.(`${g.name} left the game`);
    }
  }

  private receive(g: Guest, m: Message) {
    if (!g.welcomed) {
      if (m.t !== "hello") return;
      if (m.version !== PROTOCOL_VERSION) {
        g.peer.send({ t: "refused", reason: "The host is on a different version of the game. Both of you should reload the page." });
        setTimeout(() => g.peer.close(), 500);
        return;
      }
      g.name = cleanName(m.name);
      g.welcomed = true;
      const info = this.game.worldInfo();
      g.peer.send({
        t: "welcome", id: g.id, world: info, time: this.game.time, weather: this.game.weather.serialize(),
        spawn: this.game.spawn(), modified: [...this.modified],
        you: this.game.guestSave(g.id, g.name),
        players: [{ id: "host", name: this.selfName }, ...[...this.guests.values()].filter((o) => o !== g && o.welcomed).map((o) => ({ id: o.id, name: o.name }))],
      });
      // Everything lying around right now.
      const drops = this.game.drops.list();
      for (let i = 0; i < drops.length; i += 100) g.peer.send({ t: "drops", d: drops.slice(i, i + 100) });
      const orbs = this.game.xpOrbs.list();
      if (orbs.length) g.peer.send({ t: "orbs", o: orbs });
      this.broadcast({ t: "join", id: g.id, name: g.name }, g);
      this.remotes.add(g.id, g.name);
      this.onInfo?.(`${g.name} joined the game`);
      return;
    }
    switch (m.t) {
      case "p":
        g.x = m.s.x;
        g.y = m.s.y;
        g.z = m.s.z;
        g.state = m.s;
        this.remotes.state(g.id, m.s);
        this.broadcast({ t: "p", id: g.id, s: m.s }, g);
        break;
      case "set":
        if (!Array.isArray(m.c) || m.c.length % 4 || m.c.length > 4000) return;
        this.applying = true;
        try {
          this.game.applyEdits(m.c);
        } finally {
          this.applying = false;
        }
        break;
      case "chunk?":
        void this.sendChunk(g, m.cx, m.cz);
        break;
      case "save":
        if (m.p && typeof m.p === "object" && Array.isArray(m.p.inventory)) this.game.saveGuest(g.id, g.name, m.p);
        break;
      case "hit": {
        const mob = this.game.entities.mobs.get(m.mob);
        if (mob && !mob.dead && Number.isFinite(m.damage)) {
          mob.hurt(Math.min(40, Math.max(0, m.damage)), { weapon: m.weapon, from: { x: m.fx, z: m.fz } });
          mob.lastHitBy = g.id;
        }
        break;
      }
      case "feed": {
        const mob = this.game.entities.mobs.get(m.mob);
        if (mob && this.game.feedFromGuest(mob, m.item)) g.peer.send({ t: "fed", item: m.item });
        break;
      }
      case "pick": {
        const item = this.game.drops.give(m.id, g.x, g.y, g.z);
        if (item) g.peer.send({ t: "give", item: item.id, count: item.count, wear: item.wear ?? 0 });
        break;
      }
      case "throw": {
        const [x, y, z] = m.p;
        if (![x, y, z].every(Number.isFinite) || !(m.count > 0 && m.count <= 64)) break;
        const v = m.v ? new THREE.Vector3(...m.v) : undefined;
        this.game.drops.spawn(m.item, m.count, x, y, z, v, m.delay, m.wear || undefined);
        break;
      }
      case "orb":
        if (Number.isFinite(m.v) && m.v > 0 && m.v < 2000) this.game.xpOrbs.spawn(m.v, m.p[0], m.p[1], m.p[2]);
        break;
      case "shoot": {
        const [x, y, z, vx, vy, vz] = m.a;
        this.shooter = g;
        try {
          this.game.projectiles.shoot(new THREE.Vector3(x, y, z), new THREE.Vector3(vx, vy, vz),
            { fromPlayer: true, shooter: null, damage: Math.min(10, Math.max(0, m.damage)), pickup: !!m.pickup, item: THROWN_ITEMS.has(m.item ?? 0) ? m.item : undefined });
        } finally {
          this.shooter = null;
        }
        break;
      }
      case "furnace?": {
        g.furnace = m.p;
        const f = this.game.furnaces.get(...m.p);
        g.peer.send({ t: "furnace", p: m.p, f });
        break;
      }
      case "furnace=": {
        // The guest moved items in or out: take their slots (the fire and cooking stay ours).
        const f = this.game.furnaces.get(...m.p);
        f.input = m.f.input;
        f.fuel = m.f.fuel;
        f.output = m.f.output;
        f.xp = m.f.xp;
        break;
      }
      case "furnace.":
        g.furnace = null;
        break;
      case "chat": {
        const text = String(m.text).slice(0, 256);
        this.onChat?.(g.name, text);
        this.broadcast({ t: "chat", id: g.id, text }, g);
        break;
      }
    }
  }

  private async sendChunk(g: Guest, cx: number, cz: number) {
    const blocks = await this.game.chunkData(cx, cz).catch(() => null);
    g.peer.send({ t: "chunk", cx, cz, data: blocks ? bytesToBase64(rleEncode(blocks)) : null });
  }

  /** Drops and orbs appearing or going in the host's world (batched per frame). */
  dropSpawned(d: DropNet) {
    this.dropsNew.push(d);
  }
  dropRemoved(netId: number) {
    this.dropsGone.push(netId);
  }
  dropCounted(netId: number, count: number) {
    this.broadcast({ t: "drop~", id: netId, count });
  }
  orbSpawned(o: OrbNet) {
    this.orbsNew.push(o);
  }
  orbRemoved(netId: number) {
    this.orbsGone.push(netId);
  }

  /** An arrow was loosed in the host's world: everyone sees it (except whoever shot it, who already does). */
  arrowShot(from: THREE.Vector3, vel: THREE.Vector3, item: number) {
    const r = (v: number) => Math.round(v * 100) / 100;
    this.broadcast({ t: "arrow", a: [r(from.x), r(from.y), r(from.z), r(vel.x), r(vel.y), r(vel.z)], item }, this.shooter ?? undefined);
  }

  /** A guest killed one of our mobs: their achievements, not ours. */
  creditKill(id: string, type: string, hostile: boolean, weapon: number) {
    this.guests.get(id)?.peer.send({ t: "kill", type, hostile, weapon });
  }

  /** A guest walked over an arrow stuck in the ground: it's theirs. */
  giveArrow(id: string) {
    this.guests.get(id)?.peer.send({ t: "give", item: 272, count: 1, wear: 0 });
  }

  /** Guests holding something, so animals can follow their food. */
  holders(): { x: number; y: number; z: number; item: number }[] {
    return [...this.guests.values()].filter((g) => g.welcomed && g.state && !g.state.dead && g.state.held).map((g) => ({ x: g.x, y: g.y, z: g.z, item: g.state!.held }));
  }

  /** An experience orb reached a guest. */
  giveXp(id: string, points: number) {
    this.guests.get(id)?.peer.send({ t: "xp", v: points });
  }

  /** A mob or arrow hurt a guest. */
  hurtGuest(id: string, amount: number, cause: "mob" | "arrow", fromX: number, fromZ: number) {
    this.guests.get(id)?.peer.send({ t: "hurt", amount, cause, fx: fromX, fz: fromZ });
  }

  /** Guests' bodies, for mobs to chase and arrows to hit (alive ones only). */
  bodies(): { id: string; x: number; y: number; z: number; half: number; height: number }[] {
    return [...this.guests.values()].filter((g) => g.welcomed && g.state && !g.state.dead && !g.state.creative).map((g) => ({ id: g.id, x: g.x, y: g.y, z: g.z, half: 0.3, height: 1.8 }));
  }

  /** Guests' positions, for the mob spawner. */
  positions() {
    return [...this.guests.values()].filter((g) => g.welcomed).map((g) => ({ x: g.x, y: g.y, z: g.z }));
  }

  /** Every block change in the host's world goes out to everyone (batched per frame). */
  blockChanged(x: number, y: number, z: number, id: number) {
    this.edits.push(x, y, z, id);
    this.modified.add(`${Math.floor(x / 16)},${Math.floor(z / 16)}`);
  }

  private broadcast(m: Message, except?: Guest) {
    for (const g of this.guests.values()) if (g.welcomed && g !== except) g.peer.send(m);
  }

  /** Call once a frame. */
  update(dt: number, lightAt: (x: number, y: number, z: number) => number, daylight: number) {
    if (this.edits.length) {
      for (let i = 0; i < this.edits.length; i += 4000) this.broadcast({ t: "set", c: this.edits.slice(i, i + 4000) });
      this.edits = [];
    }
    if (this.dropsNew.length) this.broadcast({ t: "drops", d: this.dropsNew.splice(0) });
    if (this.dropsGone.length) this.broadcast({ t: "drop-", ids: this.dropsGone.splice(0) });
    if (this.orbsNew.length) this.broadcast({ t: "orbs", o: this.orbsNew.splice(0) });
    if (this.orbsGone.length) this.broadcast({ t: "orb-", ids: this.orbsGone.splice(0) });
    this.mobTimer += dt;
    if (this.mobTimer >= 0.1) {
      this.mobTimer = 0;
      for (const g of this.guests.values()) if (g.welcomed) g.peer.send({ t: "mobs", m: this.game.entities.snapshot(g.x, g.z, MOB_RANGE) });
    }
    this.furnaceTimer += dt;
    if (this.furnaceTimer >= 0.25) {
      this.furnaceTimer = 0;
      for (const g of this.guests.values()) if (g.furnace) g.peer.send({ t: "furnace", p: g.furnace, f: this.game.furnaces.get(...g.furnace) });
    }
    this.stateTimer += dt;
    if (this.stateTimer >= 1 / STATE_HZ) {
      this.stateTimer = 0;
      this.broadcast({ t: "p", id: "host", s: this.game.playerState() });
    }
    this.skyTimer += dt;
    if (this.skyTimer >= 3) {
      this.skyTimer = 0;
      this.broadcast({ t: "sky", time: this.game.time, weather: this.game.weather.serialize() });
    }
    this.game.world.extraCenters = [...this.guests.values()].filter((g) => g.welcomed).map((g) => ({ x: g.x, z: g.z }));
    this.remotes.update(dt, lightAt, daylight);
  }

  /** Our own chat line, for everyone. */
  chat(text: string) {
    this.broadcast({ t: "chat", id: "host", text: text.slice(0, 256) });
  }

  /** Time or weather changed by a command: tell everyone now. */
  skyChanged() {
    this.skyTimer = 3;
  }

  async close(reason = "The host closed the world") {
    if (this.closed) return;
    this.closed = true;
    this.broadcast({ t: "bye", reason });
    await new Promise((r) => setTimeout(r, 150));
    for (const g of [...this.guests.values()]) g.peer.close();
    this.guests.clear();
    this.remotes.clear();
    this.game.world.extraCenters = [];
    await this.sig.closeRoom(this.code).catch(() => {});
  }
}

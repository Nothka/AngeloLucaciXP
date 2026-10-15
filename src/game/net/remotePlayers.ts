import * as THREE from "three";
import { buildPlayerFigure, type PlayerFigure } from "../ui/playerPortrait";
import type { NetPlayerState } from "./protocol";

const PX = 1 / 16;
/** Network updates arrive 15 times a second; draw this far behind them to always have two to blend between. */
const INTERP_DELAY = 0.12;

function nameTag(name: string): THREE.Sprite {
  const c = document.createElement("canvas");
  const g = c.getContext("2d")!;
  g.font = "bold 28px monospace";
  const w = Math.ceil(g.measureText(name).width) + 20;
  c.width = w;
  c.height = 40;
  g.fillStyle = "rgba(0,0,0,0.45)";
  g.fillRect(0, 0, w, 40);
  g.font = "bold 28px monospace";
  g.fillStyle = "#ffffff";
  g.textBaseline = "middle";
  g.fillText(name, 10, 21);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set((w / 40) * 0.3, 0.3, 1);
  sprite.renderOrder = 10;
  return sprite;
}

interface Snapshot {
  at: number;
  s: NetPlayerState;
}

class RemotePlayer {
  readonly group = new THREE.Group();
  private figure: PlayerFigure;
  private snaps: Snapshot[] = [];
  private walk = 0;
  private swing = 1;
  private lastSwings = 0;
  readonly pos = new THREE.Vector3();

  constructor(readonly id: string, readonly name: string) {
    this.figure = buildPlayerFigure();
    this.figure.root.scale.setScalar(PX * 0.9);
    const tag = nameTag(name);
    tag.position.y = 2.15;
    this.group.add(this.figure.root, tag);
    this.group.visible = false;
  }

  push(s: NetPlayerState, now: number) {
    this.snaps.push({ at: now, s });
    if (this.snaps.length > 8) this.snaps.shift();
  }

  update(dt: number, now: number, lightAt: (x: number, y: number, z: number) => number, daylight: number) {
    if (!this.snaps.length) return;
    const t = now - INTERP_DELAY;
    let a = this.snaps[0], b = this.snaps[this.snaps.length - 1];
    for (let i = 0; i < this.snaps.length - 1; i++) {
      if (this.snaps[i].at <= t && this.snaps[i + 1].at >= t) {
        a = this.snaps[i];
        b = this.snaps[i + 1];
        break;
      }
    }
    const k = b.at > a.at ? Math.max(0, Math.min(1, (t - a.at) / (b.at - a.at))) : 1;
    const lerp = (x: number, y: number) => x + (y - x) * k;
    const lerpAngle = (x: number, y: number) => x + Math.atan2(Math.sin(y - x), Math.cos(y - x)) * k;
    const s = b.s;
    const prev = this.pos.clone();
    this.pos.set(lerp(a.s.x, s.x), lerp(a.s.y, s.y), lerp(a.s.z, s.z));
    const yaw = lerpAngle(a.s.yaw, s.yaw);
    const pitch = lerp(a.s.pitch, s.pitch);
    this.group.visible = !s.dead;
    this.group.position.copy(this.pos);
    const f = this.figure;
    // The figure faces +Z; player yaw 0 looks toward -Z.
    f.root.rotation.y = yaw + Math.PI;
    f.head.rotation.x = -pitch;
    // Legs and arms swing with distance walked.
    const moved = Math.hypot(this.pos.x - prev.x, this.pos.z - prev.z);
    this.walk += moved * 3.2;
    const stride = Math.min(1, moved / Math.max(dt, 1e-3) / 4.3);
    const sw = Math.sin(this.walk) * 0.8 * stride;
    f.legL.rotation.x = sw;
    f.legR.rotation.x = -sw;
    f.armL.rotation.x = -sw * 0.8;
    // A swing for every hit or placement.
    if (s.swings !== this.lastSwings) {
      this.lastSwings = s.swings;
      this.swing = 0;
    }
    this.swing = Math.min(1, this.swing + dt / 0.3);
    f.armR.rotation.x = sw * 0.8 - Math.sin(this.swing * Math.PI) * 1.4;
    f.body.rotation.x = s.sneak ? 0.35 : 0;
    f.root.position.y = s.sneak ? -0.12 : 0;
    // Lit like the world around them.
    const light = lightAt(Math.floor(this.pos.x), Math.floor(this.pos.y + 1), Math.floor(this.pos.z));
    const level = Math.max(((light >> 4) / 15) * daylight, (light & 15) / 15);
    const shade = 0.12 + 0.88 * level;
    for (const m of f.materials) m.color.setScalar(shade * (m.userData.shade ?? 1));
  }
}

/** Everyone else in the world, drawn from the positions they send. */
export class RemotePlayers {
  readonly group = new THREE.Group();
  private players = new Map<string, RemotePlayer>();
  private clock = 0;

  get count() {
    return this.players.size;
  }

  names() {
    return [...this.players.values()].map((p) => p.name);
  }

  add(id: string, name: string) {
    if (this.players.has(id)) return;
    const p = new RemotePlayer(id, name);
    this.players.set(id, p);
    this.group.add(p.group);
  }

  remove(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    this.group.remove(p.group);
    this.players.delete(id);
  }

  nameOf(id: string) {
    return this.players.get(id)?.name;
  }

  state(id: string, s: NetPlayerState) {
    this.players.get(id)?.push(s, this.clock);
  }

  update(dt: number, lightAt: (x: number, y: number, z: number) => number, daylight: number) {
    this.clock += dt;
    for (const p of this.players.values()) p.update(dt, this.clock, lightAt, daylight);
  }

  clear() {
    for (const id of [...this.players.keys()]) this.remove(id);
  }
}

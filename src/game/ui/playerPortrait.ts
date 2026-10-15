import * as THREE from "three";
import { Pixels } from "../render/textures";

/**
 * The inventory's player figure: a small box model in its own WebGL view
 * whose head turns to follow the mouse (the body follows a little).
 * One instance is shared by every inventory opening, so only one extra
 * WebGL context ever exists.
 */

type Face = "right" | "left" | "top" | "bottom" | "front" | "back";
type Painter = (p: Pixels, face: Face) => void;

const SKIN = "#d6a07c";
const SKIN_DARK = "#c7926f";
const HAIR = "#3b2a1e";
const SHIRT = ["#2a9d93", "#22867f", "#2a9d93", "#2fa79c"];
const PANTS = ["#4a3a6b", "#55447a"];

const head: Painter = (p, f) => {
  p.fill((x, y) => (f === "top" ? HAIR : y < (f === "back" ? 10 : 3) ? HAIR : (x + y) % 9 === 0 ? SKIN_DARK : SKIN));
  if (f === "front") {
    for (let y = 3; y < 5; y++) for (let x = 0; x < 16; x++) if (x < 2 || x > 13) p.set(x, y, HAIR);
    for (const [x, y] of [[3, 8], [4, 8], [11, 8], [12, 8]]) p.set(x, y, "#ffffff");
    for (const [x, y] of [[5, 8], [10, 8], [5, 9], [10, 9]]) p.set(x, y, "#2d4f8f");
    for (let x = 6; x < 10; x++) p.set(x, 12, "#9a5f45");
  }
  if (f === "right" || f === "left") for (let y = 3; y < 7; y++) for (let x = 0; x < 16; x++) if (f === "right" ? x > 9 : x < 6) p.set(x, y, HAIR);
};
const body: Painter = (p, f) => {
  p.fill((x, y) => SHIRT[(x + y * 3) % SHIRT.length]);
  if (f === "front") for (let i = 0; i < 16; i++) p.set(i, Math.min(15, Math.floor(i * 0.9)), "#1f7a74");
};
const arm: Painter = (p) => p.fill((x, y) => (y < 6 ? SHIRT[(x + y) % SHIRT.length] : y > 13 ? SKIN_DARK : SKIN));
const leg: Painter = (p) => p.fill((x, y) => (y > 12 ? "#3a3a3a" : PANTS[(x + y) % PANTS.length]));

const FACES: Face[] = ["right", "left", "top", "bottom", "front", "back"];

/** Same face shading as world blocks, so the figure reads as solid. */
const SHADE: Record<Face, number> = { right: 0.78, left: 0.78, top: 1, bottom: 0.55, front: 0.92, back: 0.7 };

function materials(paint: Painter) {
  return FACES.map((face) => {
    const p = new Pixels();
    paint(p, face);
    const tex = new THREE.CanvasTexture(p.toCanvas());
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: tex });
    material.color.setScalar(SHADE[face]);
    material.userData.shade = SHADE[face];
    return material;
  });
}

/** A box sized in pixels, hanging from (or sitting on) its pivot. */
function part(paint: Painter, w: number, h: number, d: number, pivot: [number, number, number], offsetY: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, offsetY, 0);
  const mesh = new THREE.Mesh(geo, materials(paint));
  const g = new THREE.Group();
  g.position.set(...pivot);
  g.add(mesh);
  return g;
}

/** The player's box figure (in pixels: feet at y = 0, 32 tall, facing +Z) with its moving parts. */
export interface PlayerFigure {
  root: THREE.Group;
  head: THREE.Group;
  body: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  /** Every material, so the figure can be tinted by the light it stands in. */
  materials: THREE.MeshBasicMaterial[];
}

export function buildPlayerFigure(): PlayerFigure {
  const head_ = part(head, 8, 8, 8, [0, 24, 0], 4);
  const torso = part(body, 8, 12, 4, [0, 12, 0], 6);
  const armL = part(arm, 4, 12, 4, [-6, 24, 0], -6);
  const armR = part(arm, 4, 12, 4, [6, 24, 0], -6);
  armL.rotation.z = -0.08;
  armR.rotation.z = 0.08;
  const legL = part(leg, 4, 12, 4, [-2, 12, 0], -6);
  const legR = part(leg, 4, 12, 4, [2, 12, 0], -6);
  const bodyGroup = new THREE.Group();
  bodyGroup.add(torso, armL, armR, legL, legR);
  const root = new THREE.Group();
  root.add(bodyGroup, head_);
  const materials: THREE.MeshBasicMaterial[] = [];
  root.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (Array.isArray(m)) materials.push(...(m as THREE.MeshBasicMaterial[]));
  });
  return { root, head: head_, body: bodyGroup, armL, armR, legL, legR, materials };
}

export class PlayerPortrait {
  readonly canvas = document.createElement("canvas");
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(25, 51 / 72, 1, 400);
  private root = new THREE.Group();
  private head: THREE.Group;
  private bodyGroup: THREE.Group;
  private raf = 0;

  constructor() {
    // Feet at y = 0, 32 px tall, facing +Z (toward the camera).
    const figure = buildPlayerFigure();
    this.head = figure.head;
    this.bodyGroup = figure.body;
    this.root.add(figure.root);
    this.scene.add(this.root);
    this.camera.position.set(0, 17, 92);
    this.camera.lookAt(0, 16.5, 0);
  }

  /** Puts the canvas into `parent` and draws the first frame. */
  attach(parent: HTMLElement) {
    parent.append(this.canvas);
    try {
      this.renderer ??= new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: false });
    } catch {
      return;
    }
    this.renderer.setClearColor(0x000000, 0);
    this.reset();
    requestAnimationFrame(() => this.render());
  }

  reset() {
    this.head.rotation.set(0, 0, 0);
    this.bodyGroup.rotation.set(0, 0, 0);
  }

  /** Turns the head toward a screen point, like the figure watching the cursor. */
  lookAt(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width) return;
    const headX = r.left + r.width / 2;
    const headY = r.top + r.height * 0.22;
    // Scale by the box size so the response feels the same at any GUI scale.
    const k = r.width * 0.9;
    const yaw = Math.atan((clientX - headX) / k);
    const pitch = Math.atan((clientY - headY) / k);
    this.head.rotation.set(Math.max(-0.7, Math.min(0.7, pitch * 0.9)), Math.max(-1.1, Math.min(1.1, yaw)), 0, "YXZ");
    this.bodyGroup.rotation.y = Math.max(-0.5, Math.min(0.5, yaw * 0.4));
    if (!this.raf) this.raf = requestAnimationFrame(() => this.render());
  }

  private render() {
    this.raf = 0;
    const r = this.renderer;
    if (!r) return;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (this.canvas.width !== Math.round(w * r.getPixelRatio()) || this.canvas.height !== Math.round(h * r.getPixelRatio())) {
      r.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    r.render(this.scene, this.camera);
  }
}

let shared: PlayerPortrait | null = null;
export const playerPortrait = () => (shared ??= new PlayerPortrait());

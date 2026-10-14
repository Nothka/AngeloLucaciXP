import * as THREE from "three";
import { mulberry32 } from "../noise";
import { Pixels } from "../render/textures";
import type { Mob } from "./mob";
import { SHEEP_COLORS, type MobType } from "./mobTypes";

/**
 * Mob models are a handful of boxes each, measured in pixels (1/16 block),
 * with every face painted procedurally. Each part of each mob type is one
 * InstancedMesh, so the whole population draws in a few dozen calls no
 * matter how many mobs are around.
 */

type Face = "side" | "top" | "bottom" | "front" | "back";
type Painter = (p: Pixels, face: Face, rand: () => number) => void;
type Anim = "none" | "legA" | "legB" | "armA" | "armB" | "wingA" | "wingB" | "head" | "spiderA" | "spiderB";

interface PartDef {
  size: [number, number, number];
  /** Joint position in model space (pixels, origin at the feet, +Z forward). */
  pivot: [number, number, number];
  /** Box centre relative to the joint. */
  offset: [number, number, number];
  paint: Painter;
  anim: Anim;
  /** Multiply by the sheep's fleece colour. */
  tint?: boolean;
  /** Base rotation around X (radians), e.g. a shambler's outstretched arms. */
  baseRotX?: number;
  /** Base rotations around Y and Z (spider legs splay out and down). */
  baseRotY?: number;
  baseRotZ?: number;
  /** Transparent pixels are cut out (thin props like a bow). */
  cutout?: boolean;
}

const FACES: Face[] = ["side", "top", "bottom", "front", "back"];

const noise = (palette: string[]): Painter => (p, _f, rand) => p.fill(() => palette[Math.floor(rand() * rand() * palette.length * 1.3) % palette.length]);

function eyes(p: Pixels, y: number, white: string, pupil: string, gap = 3) {
  const l = 8 - gap - 1;
  const r = 8 + gap - 1;
  p.set(l, y, white); p.set(l + 1, y, pupil);
  p.set(r, y, pupil); p.set(r + 1, y, white);
}

const WOOL = ["#f4f2ee", "#e9e6e0", "#ffffff", "#dedad3"];
const SHEEP_SKIN = ["#d9c3ad", "#cdb59d", "#e3cfba"];
const COW_HIDE = ["#4b3020", "#5a3a26", "#432a1b"];
const PIG = ["#f0a5a3", "#e8999a", "#f6b3b1", "#e08d8e"];
const FEATHERS = ["#ffffff", "#f1f0ec", "#e6e4de"];
const SHAMBLER_SKIN = ["#6f8f52", "#5f8046", "#7b9b5c", "#577540"];
const SHIRT = ["#3f6670", "#36585f", "#477580"];
const PANTS = ["#3a3d5e", "#33365a", "#41446a"];
const BONE = ["#d8d4c8", "#cbc6b8", "#e4e0d6", "#bdb8aa"];

const sheepHead: Painter = (p, f, r) => {
  noise(f === "top" || f === "back" ? WOOL : SHEEP_SKIN)(p, f, r);
  if (f === "front") {
    for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) p.set(x, y, WOOL[(x + y) % WOOL.length]);
    eyes(p, 7, "#ffffff", "#1d1a17");
    p.set(7, 12, "#a07f68"); p.set(8, 12, "#a07f68");
  }
  if (f === "side") for (let x = 0; x < 16; x++) for (let y = 0; y < 5; y++) p.set(x, y, WOOL[(x * 3 + y) % WOOL.length]);
};
const sheepLeg: Painter = (p, f, r) => {
  noise(SHEEP_SKIN)(p, f, r);
  if (f !== "top" && f !== "bottom") for (let x = 0; x < 16; x++) for (let y = 0; y < 7; y++) p.set(x, y, WOOL[(x + y * 2) % WOOL.length]);
  if (f !== "top") for (let x = 0; x < 16; x++) for (let y = 13; y < 16; y++) p.set(x, y, "#6d5a4a");
};

const cowBody: Painter = (p, f, r) => {
  noise(COW_HIDE)(p, f, r);
  const rand = mulberry32(f.length * 31 + 7);
  for (let k = 0; k < 3; k++) {
    const cx = rand() * 16, cy = rand() * 16, rad = 2 + rand() * 3;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - cx, y - cy) < rad) p.set(x, y, (x + y) % 5 ? "#ece8e0" : "#d9d4ca");
  }
};
const cowHead: Painter = (p, f, r) => {
  noise(COW_HIDE)(p, f, r);
  if (f === "front") {
    for (let y = 2; y < 10; y++) for (let x = 6; x < 10; x++) p.set(x, y, "#ece8e0");
    eyes(p, 6, "#ffffff", "#141210", 4);
    for (let y = 11; y < 16; y++) for (let x = 3; x < 13; x++) p.set(x, y, y === 13 && (x === 5 || x === 10) ? "#5c3a3a" : "#c99a8a");
  }
};
const cowLeg: Painter = (p, f, r) => {
  noise(COW_HIDE)(p, f, r);
  if (f !== "top") for (let x = 0; x < 16; x++) for (let y = 12; y < 16; y++) p.set(x, y, y < 13 ? "#ece8e0" : "#2a221c");
};

const pigBody = noise(PIG);
const pigHead: Painter = (p, f, r) => {
  noise(PIG)(p, f, r);
  if (f === "front") eyes(p, 6, "#ffffff", "#1d1a17", 4);
};
const pigSnout: Painter = (p, f) => {
  p.fill(() => "#e88d93");
  if (f === "front") for (const [x, y] of [[4, 6], [4, 7], [11, 6], [11, 7]]) p.set(x, y, "#8a3e44");
};
const pigLeg: Painter = (p, f, r) => {
  noise(PIG)(p, f, r);
  if (f !== "top") for (let x = 0; x < 16; x++) for (let y = 13; y < 16; y++) p.set(x, y, "#a8686c");
};

const chickenBody = noise(FEATHERS);
const chickenHead: Painter = (p, f, r) => {
  noise(FEATHERS)(p, f, r);
  if (f === "front") eyes(p, 5, "#1d1a17", "#1d1a17", 3);
};
const beak: Painter = (p) => p.fill((x, y) => (y < 8 ? "#f2b531" : "#d9922a"));
const wattle: Painter = (p) => p.fill(() => "#d4282f");
const chickenLeg: Painter = (p) => p.fill((x, y) => (y > 12 ? "#d9922a" : "#f2b531"));
const wing: Painter = (p, f, r) => {
  noise(FEATHERS)(p, f, r);
  for (let x = 0; x < 16; x++) p.set(x, 15, "#c9c6be");
};

const shamblerHead: Painter = (p, f, r) => {
  noise(SHAMBLER_SKIN)(p, f, r);
  if (f === "top") for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (r() < 0.4) p.set(x, y, "#3f5a2c");
  if (f === "front") {
    for (const [x, y] of [[4, 7], [5, 7], [10, 7], [11, 7]]) p.set(x, y, "#141f0c");
    for (const [x, y] of [[4, 8], [11, 8]]) p.set(x, y, "#2b3d1d");
    for (let x = 6; x < 10; x++) p.set(x, 12, "#2b3d1d");
    p.set(7, 13, "#2b3d1d");
  }
};
const shamblerBody: Painter = (p, f, r) => {
  noise(SHIRT)(p, f, r);
  // Ragged shirt: holes show the skin underneath.
  for (let k = 0; k < 7; k++) p.set(Math.floor(r() * 16), Math.floor(r() * 16), SHAMBLER_SKIN[k % 4]);
  if (f === "front") for (let x = 0; x < 16; x++) if (r() < 0.5) p.set(x, 15, "#2a454b");
};
const shamblerArm: Painter = (p, f, r) => {
  noise(SHAMBLER_SKIN)(p, f, r);
  if (f !== "bottom") for (let x = 0; x < 16; x++) for (let y = 0; y < 5; y++) p.set(x, y, SHIRT[(x + y) % 3]);
};
const shamblerLeg: Painter = (p, f, r) => {
  noise(PANTS)(p, f, r);
  if (f !== "top") for (let x = 0; x < 16; x++) for (let y = 13; y < 16; y++) p.set(x, y, "#2a2b2e");
};

const rattlerHead: Painter = (p, f, r) => {
  noise(BONE)(p, f, r);
  if (f === "front") {
    for (const [x, y] of [[3, 6], [4, 6], [5, 6], [3, 7], [4, 7], [5, 7], [10, 6], [11, 6], [12, 6], [10, 7], [11, 7], [12, 7]]) p.set(x, y, "#1b1a18");
    p.set(7, 9, "#4a4740"); p.set(8, 9, "#4a4740");
    for (let x = 4; x < 12; x++) p.set(x, 12, x % 2 ? "#1b1a18" : "#ece8dc");
  }
};
const rattlerBody: Painter = (p, f, r) => {
  p.fill(() => "#1b1a18");
  if (f === "front" || f === "back") {
    for (let y = 1; y < 15; y += 3) for (let x = 2; x < 14; x++) p.set(x, y, BONE[Math.floor(r() * 4)]);
    for (let y = 0; y < 16; y++) { p.set(7, y, "#cbc6b8"); p.set(8, y, "#bdb8aa"); }
  } else {
    for (let y = 0; y < 16; y += 3) for (let x = 0; x < 16; x++) p.set(x, y, BONE[(x + y) % 4]);
  }
};
const rattlerLimb = noise(BONE);

/** A bow held vertically: limbs curve forward, the string runs straight down the back. */
const bowProp: Painter = (p, f) => {
  if (f === "front" || f === "back" || f === "top" || f === "bottom") {
    p.fill(() => "#6b4a2a");
    return;
  }
  for (let y = 0; y < 16; y++) {
    const bulge = Math.round(Math.sin((y / 15) * Math.PI) * 9);
    p.set(2 + bulge, y, y % 4 === 0 ? "#5c4023" : "#8a6339");
    p.set(3 + bulge, y, "#6b4a2a");
    p.set(1, y, "#ece9e0");
  }
};

const SPIDER = ["#3b332e", "#2f2925", "#463c36", "#28221f"];
const spiderBody: Painter = (p, f, r) => {
  noise(SPIDER)(p, f, r);
  if (f === "top") for (let y = 3; y < 13; y += 3) for (let x = 4; x < 12; x++) if (r() < 0.6) p.set(x, y, "#5a4a3e");
};
const spiderHead: Painter = (p, f, r) => {
  noise(SPIDER)(p, f, r);
  if (f === "front") {
    for (const [x, y] of [[3, 6], [4, 6], [11, 6], [12, 6], [6, 5], [9, 5], [5, 8], [10, 8]]) p.set(x, y, "#d4162c");
    for (const [x, y] of [[4, 6], [11, 6]]) p.set(x, y, "#ff5a5a");
  }
};
const spiderLeg = noise(["#2f2925", "#3b332e", "#25201c"]);

const B = (size: [number, number, number], pivot: [number, number, number], offset: [number, number, number], paint: Painter, anim: Anim = "none", extra: Partial<PartDef> = {}): PartDef => ({ size, pivot, offset, paint, anim, ...extra });

/** Four-legged body plan shared by the farm animals. */
const quadruped = (body: PartDef, head: PartDef[], leg: Painter, legSize: [number, number, number], legX: number, legZ: number) => [
  body,
  ...head,
  B(legSize, [-legX, legSize[1], legZ], [0, -legSize[1] / 2, 0], leg, "legA"),
  B(legSize, [legX, legSize[1], legZ], [0, -legSize[1] / 2, 0], leg, "legB"),
  B(legSize, [-legX, legSize[1], -legZ], [0, -legSize[1] / 2, 0], leg, "legB"),
  B(legSize, [legX, legSize[1], -legZ], [0, -legSize[1] / 2, 0], leg, "legA"),
];

const humanoid = (head: Painter, body: Painter, arm: Painter, leg: Painter, limb: number, armsForward: boolean) => [
  B([8, 8, 8], [0, 24, 0], [0, 4, 0], head, "head"),
  B([8, 12, 4], [0, 12, 0], [0, 6, 0], body),
  B([limb, 12, limb], [-(4 + limb / 2), 22, 0], [0, -4, 0], arm, "armA", { baseRotX: armsForward ? -Math.PI / 2 : 0 }),
  B([limb, 12, limb], [4 + limb / 2, 22, 0], [0, -4, 0], arm, "armB", { baseRotX: armsForward ? -Math.PI / 2 : 0 }),
  B([limb, 12, limb], [-limb / 2 - 0.1, 12, 0], [0, -6, 0], leg, "legA"),
  B([limb, 12, limb], [limb / 2 + 0.1, 12, 0], [0, -6, 0], leg, "legB"),
];

const MODELS: Record<MobType, PartDef[]> = {
  sheep: quadruped(
    B([10, 9, 15], [0, 6, 0], [0, 4.5, 0], noise(WOOL), "none", { tint: true }),
    [B([6, 6, 7], [0, 13, 7], [0, 0, 3], sheepHead, "head")],
    sheepLeg, [3, 7, 3], 3, 5,
  ),
  cow: quadruped(
    B([12, 10, 18], [0, 9, 0], [0, 5, 0], cowBody),
    [B([8, 8, 6], [0, 17, 9], [0, 0, 3], cowHead, "head"), B([10, 2, 2], [0, 17, 9], [0, 4.5, 3], noise(["#d8d0bc", "#c4bba5"]), "head")],
    cowLeg, [4, 9, 4], 4, 6,
  ),
  pig: quadruped(
    B([10, 8, 14], [0, 5, 0], [0, 4, 0], pigBody),
    [B([8, 8, 7], [0, 10, 7], [0, 0, 3.5], pigHead, "head"), B([4, 3, 1], [0, 10, 7], [0, -1, 7.5], pigSnout, "head")],
    pigLeg, [4, 5, 4], 3, 5,
  ),
  chicken: [
    B([6, 6, 8], [0, 4, 0], [0, 3, 0], chickenBody),
    B([4, 6, 3], [0, 9, 3], [0, 2.5, 1.5], chickenHead, "head"),
    B([4, 2, 2], [0, 9, 3], [0, 3, 4], beak, "head"),
    B([2, 2, 1], [0, 9, 3], [0, 1, 3.5], wattle, "head"),
    B([1.5, 4, 1.5], [-1.5, 4, 0.5], [0, -2, 0], chickenLeg, "legA"),
    B([1.5, 4, 1.5], [1.5, 4, 0.5], [0, -2, 0], chickenLeg, "legB"),
    B([1, 4, 6], [-3.5, 9, 0], [0, -2, 0], wing, "wingA"),
    B([1, 4, 6], [3.5, 9, 0], [0, -2, 0], wing, "wingB"),
  ],
  zombie: humanoid(shamblerHead, shamblerBody, shamblerArm, shamblerLeg, 4, true),
  skeleton: [
    ...humanoid(rattlerHead, rattlerBody, rattlerLimb, rattlerLimb, 2, false),
    // Bow in the right hand, following that arm.
    B([1, 14, 6], [5, 22, 0], [0, -10, 1], bowProp, "armB", { cutout: true }),
  ],
  spider: [
    B([6, 6, 6], [0, 6, 0], [0, 0, 0], spiderBody),
    B([10, 8, 12], [0, 7, -3], [0, 0, -6], spiderBody),
    B([8, 8, 8], [0, 7, 3], [0, 0, 4], spiderHead, "head"),
    ...[2.5, 0.8, -0.8, -2.5].flatMap((z, i) => [
      B([16, 2, 2], [3, 7, z], [8, 0, 0], spiderLeg, i % 2 ? "spiderA" : "spiderB", { baseRotZ: -0.5, baseRotY: (i - 1.5) * -0.35 }),
      B([16, 2, 2], [-3, 7, z], [-8, 0, 0], spiderLeg, i % 2 ? "spiderB" : "spiderA", { baseRotZ: 0.5, baseRotY: (i - 1.5) * 0.35 }),
    ]),
  ],
};

/** Box geometry whose six faces map to five 16x16 tiles in one strip texture. */
function partGeometry(def: PartDef): THREE.BufferGeometry {
  const [w, h, d] = def.size;
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(def.offset[0], def.offset[1], def.offset[2]);
  // BoxGeometry face order: +X, -X, +Y, -Y, +Z (front), -Z (back).
  const tileForFace = [0, 0, 1, 2, 3, 4];
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute;
  for (let face = 0; face < 6; face++) {
    const tile = tileForFace[face];
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setX(i, (tile + uv.getX(i)) / FACES.length);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

function partTexture(def: PartDef, seed: number): THREE.Texture {
  const strip = document.createElement("canvas");
  strip.width = 16 * FACES.length;
  strip.height = 16;
  const ctx = strip.getContext("2d")!;
  FACES.forEach((face, i) => {
    const p = new Pixels();
    def.paint(p, face, mulberry32(seed + i * 97));
    ctx.drawImage(p.toCanvas(), i * 16, 0);
  });
  const tex = new THREE.CanvasTexture(strip);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const MAX_PER_TYPE = 192;
const FIRE_FRAMES = 8;

/** A looping strip of flame frames, painted from layered sine "tongues" that rise each frame. */
function fireTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16 * FIRE_FRAMES;
  const ctx = canvas.getContext("2d")!;
  const rand = mulberry32(911);
  const tongues = Array.from({ length: 7 }, (_, i) => ({ x: 1 + i * 2.3 + rand(), phase: rand() * Math.PI * 2, width: 2.6 + rand() * 1.8 }));
  for (let f = 0; f < FIRE_FRAMES; f++) {
    const p = new Pixels();
    const t = (f / FIRE_FRAMES) * Math.PI * 2;
    for (let y = 0; y < 16; y++) {
      const up = 1 - y / 15; // 0 at the bottom, 1 at the top
      for (let x = 0; x < 16; x++) {
        let heat = 0;
        for (const tg of tongues) {
          const sway = Math.sin(t + tg.phase + up * 4) * 1.4 * up;
          const d = Math.abs(x - tg.x - sway) / (tg.width * (1 - up * 0.6));
          heat = Math.max(heat, (1 - d) * (1.1 - up * (0.75 + 0.25 * Math.sin(t * 2 + tg.phase))));
        }
        heat += (rand() - 0.5) * 0.15;
        if (heat > 0.72) p.set(x, y, "#fff3a8");
        else if (heat > 0.52) p.set(x, y, "#ffc43c");
        else if (heat > 0.32) p.set(x, y, "#ff7b1c");
        else if (heat > 0.18) p.set(x, y, "#d2350c", 200);
      }
    }
    ctx.drawImage(p.toCanvas(), 0, (FIRE_FRAMES - 1 - f) * 16);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(1, 1 / FIRE_FRAMES);
  return tex;
}

/** Two crossed vertical quads, 1 x 1, standing on the origin. */
function fireGeometry() {
  const a = new THREE.PlaneGeometry(1, 1);
  a.translate(0, 0.5, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const merged = new THREE.BufferGeometry();
  const pos = [...a.getAttribute("position").array, ...b.getAttribute("position").array];
  const uv = [...a.getAttribute("uv").array, ...b.getAttribute("uv").array];
  const idx = [...a.getIndex()!.array, ...[...b.getIndex()!.array].map((i) => i + 4)];
  merged.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  merged.setIndex(idx);
  return merged;
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const SHEEP_LINEAR = SHEEP_COLORS.map((c) => c.rgb.map(srgbToLinear) as [number, number, number]);

const curve = (f: number) => {
  const b = f / (4 - 3 * f);
  return b + (f - b) * 0.4;
};

interface PartMesh {
  def: PartDef;
  mesh: THREE.InstancedMesh;
}

export class MobRenderer {
  readonly group = new THREE.Group();
  private parts = new Map<MobType, PartMesh[]>();
  private m = new THREE.Matrix4();
  private tmp = new THREE.Matrix4();
  private color = new THREE.Color();
  private q = new THREE.Quaternion();
  private euler = new THREE.Euler();
  private scale = new THREE.Vector3();
  private fire: THREE.InstancedMesh;
  private fireTex: THREE.Texture;

  constructor() {
    this.fireTex = fireTexture();
    this.fire = new THREE.InstancedMesh(
      fireGeometry(),
      new THREE.MeshBasicMaterial({ map: this.fireTex, transparent: true, alphaTest: 0.1, depthWrite: false, side: THREE.DoubleSide, fog: false }),
      MAX_PER_TYPE,
    );
    this.fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fire.count = 0;
    this.fire.frustumCulled = false;
    this.fire.renderOrder = 5;
    this.group.add(this.fire);
    let seed = 1;
    for (const [type, defs] of Object.entries(MODELS) as [MobType, PartDef[]][]) {
      const meshes = defs.map((def) => {
        const material = new THREE.MeshBasicMaterial({ map: partTexture(def, seed++ * 1013), alphaTest: def.cutout ? 0.5 : 0, side: def.cutout ? THREE.DoubleSide : THREE.FrontSide });
        const mesh = new THREE.InstancedMesh(partGeometry(def), material, MAX_PER_TYPE);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.setColorAt(0, new THREE.Color(1, 1, 1));
        mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
        mesh.count = 0;
        mesh.frustumCulled = false;
        this.group.add(mesh);
        return { def, mesh };
      });
      this.parts.set(type, meshes);
    }
  }

  /** Rebuilds every instance from the mob list; `light` returns packed light for a mob. */
  update(mobs: Iterable<Mob>, daylight: number, time: number, light: (mob: Mob) => number) {
    const counts = new Map<MobType, number>();
    let fires = 0;
    for (const mob of mobs) {
      const parts = this.parts.get(mob.type)!;
      const n = counts.get(mob.type) ?? 0;
      if (n >= MAX_PER_TYPE) continue;
      counts.set(mob.type, n + 1);

      const packed = light(mob);
      const brightness = Math.min(1, Math.max(curve(((packed >> 4) / 15) * daylight), curve((packed & 15) / 15)) + 0.04);
      const hurt = mob.hurtTime < 0.3 || mob.dead;
      const flicker = mob.burning ? 0.75 + Math.sin(time * 30) * 0.25 : 1;
      const swing = Math.sin(mob.walkPhase) * 0.8 * mob.moveAmount;
      const tilt = mob.dead ? Math.min(1, mob.deathTime / 0.5) * (Math.PI / 2) : 0;
      const s = mob.scale / 16;
      // Root: feet position, facing, death tilt, pixel scale.
      this.euler.set(0, mob.yaw, tilt, "YXZ");
      this.m.compose(mob.pos, this.q.setFromEuler(this.euler), this.scale.set(s, s, s));
      // Colour work is done once per mob in linear space; parts only multiply.
      let br = srgbToLinear(brightness), bg = br, bb = br;
      if (hurt) { bg *= 0.12; bb *= 0.12; br = Math.min(1, br * 1.8 + 0.03); }
      if (mob.burning) { br = Math.min(1, br * (1.1 + 0.4 * flicker)); bg *= 0.7 + 0.2 * flicker; bb *= 0.4; }
      const wool = SHEEP_LINEAR[mob.color] ?? SHEEP_LINEAR[0];
      // Burning mobs wear a sheet of flame a little larger than their box.
      if (mob.burning && fires < MAX_PER_TYPE) {
        this.euler.set(0, mob.yaw + Math.PI / 4, 0);
        this.tmp.compose(mob.pos, this.q.setFromEuler(this.euler), this.scale.set(mob.half * 2.6, mob.height * 1.15, mob.half * 2.6));
        this.fire.setMatrixAt(fires++, this.tmp);
        this.euler.set(0, mob.yaw, tilt, "YXZ");
        this.q.setFromEuler(this.euler);
      }

      parts.forEach(({ def, mesh }) => {
        let rx = def.baseRotX ?? 0;
        let ry = def.baseRotY ?? 0;
        let rz = def.baseRotZ ?? 0;
        if (def.anim === "legA") rx += swing;
        else if (def.anim === "legB") rx -= swing;
        else if (def.anim === "armA" || def.anim === "armB") {
          const sign = def.anim === "armA" ? -1 : 1;
          if (mob.aiming) {
            // Both arms up, bow drawn toward the target; a small kick when an arrow leaves.
            rx = -Math.PI / 2 + Math.sin(mob.attackAnim * Math.PI) * 0.25;
            ry = def.anim === "armA" ? 0.35 : -0.1;
          } else {
            rx += def.baseRotX ? swing * 0.15 * sign : swing * sign * 0.8;
            rx -= Math.sin(mob.attackAnim * Math.PI) * 0.8;
          }
        } else if (def.anim === "spiderA" || def.anim === "spiderB") {
          ry += (def.anim === "spiderA" ? 1 : -1) * swing * 0.5;
          rz += Math.abs(swing) * 0.15 * Math.sign(def.baseRotZ ?? 1);
        } else if (def.anim === "wingA" || def.anim === "wingB") {
          const flap = mob.onGround ? 0 : Math.abs(Math.sin(time * 18)) * 1.2;
          rz = def.anim === "wingA" ? -flap : flap;
        }
        this.tmp.makeRotationFromEuler(this.euler.set(rx, ry, rz, "YXZ"));
        this.tmp.setPosition(def.pivot[0], def.pivot[1], def.pivot[2]);
        this.tmp.premultiply(this.m);
        mesh.setMatrixAt(n, this.tmp);

        if (def.tint) this.color.setRGB(br * wool[0], bg * wool[1], bb * wool[2]);
        else this.color.setRGB(br, bg, bb);
        mesh.setColorAt(n, this.color);
      });
    }
    this.fire.count = fires;
    this.fire.visible = fires > 0;
    this.fire.instanceMatrix.needsUpdate = true;
    this.fireTex.offset.y = (Math.floor(time * 12) % FIRE_FRAMES) / FIRE_FRAMES;
    for (const [type, parts] of this.parts) {
      const n = counts.get(type) ?? 0;
      for (const { mesh } of parts) {
        mesh.count = n;
        mesh.visible = n > 0;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }
}

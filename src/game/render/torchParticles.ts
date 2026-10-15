import * as THREE from "three";
import { ATTACH_DIRS, B, isLitRedstoneTorch, isWallTorch, wallTorchFace } from "../world/blocks";

const MAX = 600;
/** Torches farther than this make no particles (like other small effects). */
export const TORCH_FX_RANGE = 16;

interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  age: number; life: number;
  size0: number; size1: number;
  r: number; g: number; b: number;
  alpha: number;
}

/** True for blocks with a live flame on top: torches and lit redstone torches, standing or on a wall. */
export const hasFlame = (id: number) => id === B.TORCH || (isWallTorch(id) && id < B.REDSTONE_WALL_TORCH) || isLitRedstoneTorch(id);

/** Where the flame sits inside the block: on top of the stick, or at the tip of a torch leaning off a wall. */
export function flameTip(id: number, x: number, y: number, z: number): [number, number, number] {
  if (!isWallTorch(id)) return [x + 0.5, y + 0.72, z + 0.5];
  const [dx, , dz] = ATTACH_DIRS[wallTorchFace(id)];
  // The foot rests against the wall; the tip leans 4 px out, 13 px up.
  return [x + 0.5 + dx * 0.19, y + 0.9, z + 0.5 + dz * 0.19];
}

const vertexShader = /* glsl */ `
  attribute float a_size;
  attribute vec4 a_color;
  varying vec4 v_color;
  uniform float u_scale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = a_size * u_scale / max(0.1, -mv.z);
    v_color = a_color;
    gl_Position = projectionMatrix * mv;
  }
`;
const fragmentShader = /* glsl */ `
  varying vec4 v_color;
  void main() {
    if (v_color.a < 0.02) discard;
    gl_FragColor = v_color;
  }
`;

/**
 * Torch particles: little flames flickering above each torch and wisps of
 * smoke rising off it; lit redstone torches give off red sparks instead.
 * Square points keep the pixel look.
 */
export class TorchParticles {
  readonly group = new THREE.Group();
  private list: Particle[] = [];
  private next = new Map<string, number>();
  private time = 0;
  private positions = new Float32Array(MAX * 3);
  private colors = new Float32Array(MAX * 4);
  private sizes = new Float32Array(MAX);
  private geo = new THREE.BufferGeometry();
  private material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false,
    uniforms: { u_scale: { value: 600 } },
  });

  constructor() {
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute("a_color", new THREE.BufferAttribute(this.colors, 4));
    this.geo.setAttribute("a_size", new THREE.BufferAttribute(this.sizes, 1));
    const points = new THREE.Points(this.geo, this.material);
    points.frustumCulled = false;
    points.renderOrder = 4;
    this.group.add(points);
  }

  /** Viewport height in pixels, so points keep their size in blocks. */
  setViewport(height: number, fovDeg: number) {
    this.material.uniforms.u_scale.value = height / (2 * Math.tan((fovDeg * Math.PI) / 360));
  }

  private spawn(p: Partial<Particle> & Pick<Particle, "x" | "y" | "z" | "life">) {
    if (this.list.length >= MAX) return;
    this.list.push({ vx: 0, vy: 0, vz: 0, age: 0, size0: 0.06, size1: 0.06, r: 1, g: 1, b: 1, alpha: 1, ...p });
  }

  private emit(id: number, x: number, y: number, z: number) {
    const [fx, fy, fz] = flameTip(id, x, y, z);
    const j = () => (Math.random() - 0.5) * 0.04;
    if (isLitRedstoneTorch(id)) {
      this.spawn({ x: fx + j() * 3, y: fy + 0.02, z: fz + j() * 3, vy: 0.08, life: 0.6 + Math.random() * 0.4, size0: 0.05, size1: 0.02, r: 1, g: 0.12, b: 0.06 });
      return;
    }
    const hot = Math.random();
    this.spawn({ x: fx + j(), y: fy, z: fz + j(), vy: 0.12, life: 0.3 + Math.random() * 0.25, size0: 0.05, size1: 0.015, r: 1, g: 0.55 + hot * 0.4, b: 0.1 + hot * 0.2 });
    const grey = 0.22 + Math.random() * 0.18;
    this.spawn({
      x: fx + j(), y: fy + 0.08, z: fz + j(), vx: j() * 2, vy: 0.55 + Math.random() * 0.25, vz: j() * 2,
      life: 0.9 + Math.random() * 0.7, size0: 0.04, size1: 0.09, r: grey, g: grey, b: grey, alpha: 0.45,
    });
  }

  /** `torches` are the flame-bearing blocks to consider; only those near `eye` emit. */
  update(dt: number, eye: THREE.Vector3, torches: Iterable<[number, number, number, number]>) {
    this.time += dt;
    const range2 = TORCH_FX_RANGE * TORCH_FX_RANGE;
    for (const [x, y, z, id] of torches) {
      const dx = x + 0.5 - eye.x, dy = y + 0.5 - eye.y, dz = z + 0.5 - eye.z;
      if (dx * dx + dy * dy + dz * dz > range2) continue;
      const key = `${x},${y},${z}`;
      const at = this.next.get(key);
      if (at === undefined) {
        this.next.set(key, this.time + Math.random() * 0.8);
        continue;
      }
      if (at > this.time) continue;
      this.next.set(key, this.time + 0.2 + Math.random() * 0.6);
      this.emit(id, x, y, z);
    }
    if (this.next.size > 4000) this.next.clear();

    let n = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.list[i] = this.list[this.list.length - 1];
        this.list.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy *= Math.exp(-0.8 * dt);
      const t = p.age / p.life;
      this.positions.set([p.x, p.y, p.z], n * 3);
      this.colors.set([p.r, p.g, p.b, p.alpha * (1 - t * t)], n * 4);
      this.sizes[n] = p.size0 + (p.size1 - p.size0) * t;
      n++;
    }
    this.geo.setDrawRange(0, n);
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.a_color as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.a_size as THREE.BufferAttribute).needsUpdate = true;
  }

  clear() {
    this.list = [];
    this.next.clear();
    this.geo.setDrawRange(0, 0);
  }
}

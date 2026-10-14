import * as THREE from "three";
import { DAY_TICKS } from "../config";
import { SimplexNoise, mulberry32, smoothstep } from "../noise";
import { Pixels } from "./textures";

export interface SkyState {
  daylight: number;
  skyTint: THREE.Vector3;
  fogColor: THREE.Vector3;
  sunHeight: number;
}

const DAY_TOP = new THREE.Vector3(0.45, 0.64, 1.0);
const DAY_HORIZON = new THREE.Vector3(0.74, 0.85, 1.0);
const NIGHT_TOP = new THREE.Vector3(0.008, 0.01, 0.035);
const NIGHT_HORIZON = new THREE.Vector3(0.03, 0.04, 0.09);
const SUNSET = new THREE.Vector3(1.0, 0.5, 0.22);
const TILT = 0.18;

function pixelTexture(p: Pixels) {
  const tex = new THREE.CanvasTexture(p.toCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function sunPixels() {
  const p = new Pixels(32, 32);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5));
      if (d < 6) p.set(x, y, "#fffbe6");
      else if (d < 8) p.set(x, y, "#ffe98a");
      else if (d < 12) p.set(x, y, "#ffc94a", Math.round(150 * (1 - (d - 8) / 4)));
      else if (d < 16) p.set(x, y, "#ffa63a", Math.round(50 * (1 - (d - 12) / 4)));
    }
  }
  return p;
}

function moonPixels() {
  const p = new Pixels(32, 32);
  const rand = mulberry32(42);
  for (let y = 10; y < 22; y++) {
    for (let x = 10; x < 22; x++) {
      const edge = x === 10 || y === 10 || x === 21 || y === 21;
      p.set(x, y, edge ? "#b9c0cf" : rand() < 0.2 ? "#c9cfdc" : "#e3e8f2");
    }
  }
  for (const [x, y, s] of [[13, 13, 2], [17, 15, 3], [14, 18, 2], [19, 12, 1]]) {
    for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) p.set(x + dx, y + dy, "#a7aebd");
  }
  for (let y = 6; y < 26; y++) {
    for (let x = 6; x < 26; x++) {
      if (p.alpha(x, y)) continue;
      const d = Math.max(Math.abs(x - 15.5), Math.abs(y - 15.5));
      p.set(x, y, "#c8d4ff", Math.round(40 * (1 - (d - 6) / 4)));
    }
  }
  return p;
}

function cloudPixels(size: number) {
  const noise = new SimplexNoise(9001);
  const p = new Pixels(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Tileable by sampling a torus.
      const a = (x / size) * Math.PI * 2;
      const b = (y / size) * Math.PI * 2;
      const n =
        noise.noise3(Math.cos(a) * 2.2, Math.sin(a) * 2.2, Math.cos(b) * 2.2 + Math.sin(b) * 0.7) * 0.6 +
        noise.noise3(Math.cos(a) * 5, Math.sin(a) * 5, Math.sin(b) * 5) * 0.4;
      if (n > 0.22) p.set(x, y, "#ffffff", 225);
    }
  }
  return p;
}

const skyVertex = /* glsl */ `
  varying vec3 v_dir;
  void main() {
    v_dir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_Position.z = gl_Position.w;
  }
`;

const skyFragment = /* glsl */ `
  uniform vec3 u_top;
  uniform vec3 u_horizon;
  uniform vec3 u_sunset;
  uniform vec3 u_sunDir;
  uniform float u_sunsetStrength;
  varying vec3 v_dir;
  void main() {
    vec3 d = normalize(v_dir);
    float h = d.y;
    vec3 col = mix(u_horizon, u_top, smoothstep(-0.02, 0.45, h));
    col = mix(col, u_horizon * 0.55, smoothstep(0.0, -0.35, h));
    float sunAlign = pow(max(dot(d, u_sunDir), 0.0), 3.0);
    float band = 1.0 - smoothstep(0.0, 0.5, abs(h - 0.04));
    col = mix(col, u_sunset, u_sunsetStrength * sunAlign * band);
    gl_FragColor = vec4(col, 1.0);
  }
`;

/** Sky dome, sun, moon, stars and a drifting cloud layer driven by the time of day. */
export class Sky {
  readonly group = new THREE.Group();
  readonly clouds: THREE.Mesh;
  private dome: THREE.Mesh;
  private domeMat: THREE.ShaderMaterial;
  private sun: THREE.Mesh;
  private moon: THREE.Mesh;
  private stars: THREE.Points;
  private orbit = new THREE.Group();
  private cloudMat: THREE.MeshBasicMaterial;
  private cloudTex: THREE.Texture;
  readonly state: SkyState = {
    daylight: 1,
    skyTint: new THREE.Vector3(1, 1, 1),
    fogColor: new THREE.Vector3(),
    sunHeight: 1,
  };
  private tmp = new THREE.Vector3();
  private sunDir = new THREE.Vector3();

  constructor() {
    this.domeMat = new THREE.ShaderMaterial({
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
      uniforms: {
        u_top: { value: DAY_TOP.clone() },
        u_horizon: { value: DAY_HORIZON.clone() },
        u_sunset: { value: SUNSET.clone() },
        u_sunDir: { value: new THREE.Vector3(0, 1, 0) },
        u_sunsetStrength: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), this.domeMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;

    const celestial = (pixels: Pixels, size: number) => {
      const mat = new THREE.MeshBasicMaterial({
        map: pixelTexture(pixels),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      mesh.renderOrder = -9;
      mesh.frustumCulled = false;
      return mesh;
    };
    this.sun = celestial(sunPixels(), 110);
    this.moon = celestial(moonPixels(), 90);
    this.sun.position.set(350, 0, 0);
    this.moon.position.set(-350, 0, 0);

    const rand = mulberry32(7);
    const starPos: number[] = [];
    for (let i = 0; i < 1400; i++) {
      const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) continue;
      v.normalize().multiplyScalar(360);
      starPos.push(v.x, v.y, v.z);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
    this.stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }),
    );
    this.stars.renderOrder = -9;
    this.stars.frustumCulled = false;

    // The orbit spins around the Z axis: the sun rises in +X and sets in -X.
    this.orbit.add(this.sun, this.moon, this.stars);
    this.group.add(this.dome, this.orbit);

    this.cloudTex = pixelTexture(cloudPixels(128));
    this.cloudTex.wrapS = THREE.RepeatWrapping;
    this.cloudTex.wrapT = THREE.RepeatWrapping;
    this.cloudMat = new THREE.MeshBasicMaterial({
      map: this.cloudTex,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: true,
    });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1536, 1536), this.cloudMat);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.renderOrder = 2;
    this.clouds.frustumCulled = false;
  }

  /** Updates colours and positions; returns the sky state used for lighting and fog. */
  update(timeTicks: number, camera: THREE.Camera, cloudsVisible: boolean, worldTime: number): SkyState {
    const t = (((timeTicks % DAY_TICKS) + DAY_TICKS) % DAY_TICKS) / DAY_TICKS;
    const angle = t * Math.PI * 2;
    const sunH = Math.sin(angle);
    this.sunDir.set(Math.cos(angle), sunH * Math.cos(TILT), sunH * Math.sin(TILT));

    const day = smoothstep(-0.18, 0.28, sunH);
    const sunset = (1 - smoothstep(0.0, 0.4, Math.abs(sunH))) * smoothstep(-0.35, 0.0, sunH) * 0.95;
    const top = this.tmp.copy(NIGHT_TOP).lerp(DAY_TOP, day);
    const horizon = new THREE.Vector3().copy(NIGHT_HORIZON).lerp(DAY_HORIZON, day);
    const u = this.domeMat.uniforms;
    u.u_top.value.copy(top);
    u.u_horizon.value.copy(horizon);
    u.u_sunDir.value.copy(this.sunDir);
    u.u_sunsetStrength.value = sunset;

    this.group.position.copy(camera.position);
    this.orbit.rotation.set(TILT, 0, angle);
    this.group.updateMatrixWorld(true);
    // Planes face the camera at the orbit centre.
    this.sun.lookAt(camera.position);
    this.moon.lookAt(camera.position);
    (this.stars.material as THREE.PointsMaterial).opacity = (1 - day) * 0.9;

    // Fog takes the horizon colour, warmed when looking toward a setting sun.
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const towardSun = Math.max(0, forward.x * this.sunDir.x + forward.z * this.sunDir.z);
    this.state.fogColor.copy(horizon).lerp(SUNSET, sunset * towardSun * 0.6);
    this.state.daylight = 0.22 + 0.78 * day;
    this.state.skyTint.set(1, 1, 1).lerp(new THREE.Vector3(0.62, 0.72, 1.0), 1 - day).lerp(new THREE.Vector3(1.0, 0.82, 0.68), sunset * 0.6);
    this.state.sunHeight = sunH;

    this.clouds.visible = cloudsVisible;
    if (cloudsVisible) {
      this.clouds.position.set(camera.position.x, 112, camera.position.z);
      this.cloudTex.offset.set((camera.position.x + worldTime * 1.2) / 1536, -camera.position.z / 1536);
      const c = 0.1 + 0.9 * day;
      this.cloudMat.color.setRGB(c, c, c * (0.95 + 0.05 * day), THREE.SRGBColorSpace);
      this.cloudMat.color.lerp(new THREE.Color().setRGB(1, 0.72, 0.55, THREE.SRGBColorSpace), sunset * 0.5);
    }
    return this.state;
  }
}

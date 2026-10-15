import * as THREE from "three";

const COUNT = 1400;
const RADIUS = 16;

export interface WeatherColumns {
  /** Height of the first block from the top that stops rain (rain lands on it). */
  topAt(x: number, z: number): number;
}

/**
 * Rain streaks and snowflakes around the camera. Each particle falls inside
 * one block column and stops at the first block from the top, so roofs and
 * trees keep the rain off. Whether it is snow or rain is decided once for the
 * player's spot (`snowMix`), never per column, and changes over gradually.
 */
export class WeatherRenderer {
  readonly group = new THREE.Group();
  private rainPos = new Float32Array(COUNT * 6);
  private snowPos = new Float32Array(COUNT * 3);
  private rainGeo = new THREE.BufferGeometry();
  private snowGeo = new THREE.BufferGeometry();
  private rainMat = new THREE.LineBasicMaterial({ color: 0x7f9fd8, transparent: true, opacity: 0.55, depthWrite: false, fog: true });
  private snowMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false, fog: true });
  private px = new Float32Array(COUNT);
  private py = new Float32Array(COUNT);
  private pz = new Float32Array(COUNT);
  private floor = new Float32Array(COUNT);
  private speed = new Float32Array(COUNT);
  private snow = new Uint8Array(COUNT);
  private alive = new Uint8Array(COUNT);
  private cache = new Map<number, { top: number }>();
  private mix = 0;
  private cacheAge = 0;

  constructor(private columns: WeatherColumns) {
    this.rainGeo.setAttribute("position", new THREE.BufferAttribute(this.rainPos, 3));
    this.snowGeo.setAttribute("position", new THREE.BufferAttribute(this.snowPos, 3));
    const rain = new THREE.LineSegments(this.rainGeo, this.rainMat);
    const snow = new THREE.Points(this.snowGeo, this.snowMat);
    for (const o of [rain, snow]) {
      o.frustumCulled = false;
      o.renderOrder = 3;
    }
    this.group.add(rain, snow);
    this.group.visible = false;
  }

  private column(x: number, z: number) {
    const key = ((x & 0xffff) << 16) | (z & 0xffff);
    let c = this.cache.get(key);
    if (!c) {
      c = { top: this.columns.topAt(x, z) };
      this.cache.set(key, c);
    }
    return c;
  }

  private respawn(i: number, cam: THREE.Vector3, spread: boolean) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * RADIUS;
    const x = cam.x + Math.cos(a) * r;
    const z = cam.z + Math.sin(a) * r;
    const col = this.column(Math.floor(x), Math.floor(z));
    this.px[i] = x;
    this.pz[i] = z;
    this.floor[i] = col.top;
    const snow = Math.random() < this.mix;
    this.snow[i] = snow ? 1 : 0;
    const top = cam.y + 14;
    this.py[i] = spread ? cam.y - 8 + Math.random() * 22 : top + Math.random() * 4;
    this.speed[i] = snow ? 1.6 + Math.random() * 0.8 : 17 + Math.random() * 5;
    this.alive[i] = this.py[i] > col.top ? 1 : 0;
  }

  /**
   * `level` is the eased rain strength (0..1); `snowMix` 0 rain .. 1 snow where
   * the player is; `light` dims the particles at night.
   */
  update(dt: number, cam: THREE.Vector3, level: number, snowMix: number, light: number, time: number) {
    this.mix = snowMix;
    this.cacheAge += dt;
    if (this.cacheAge > 2) {
      this.cacheAge = 0;
      this.cache.clear();
    }
    const active = Math.floor(COUNT * level);
    this.group.visible = active > 0;
    if (!active) return;
    const wasHidden = this.alive.every((v) => v === 0);
    const rp = this.rainPos;
    const sp = this.snowPos;
    for (let i = 0; i < COUNT; i++) {
      const j = i * 6;
      const k = i * 3;
      if (i >= active) {
        rp[j + 1] = rp[j + 4] = sp[k + 1] = -1000;
        continue;
      }
      const far = Math.abs(this.px[i] - cam.x) > RADIUS + 2 || Math.abs(this.pz[i] - cam.z) > RADIUS + 2;
      // Flakes of the kind that is fading out give way to the new kind.
      const unwanted = this.snow[i] ? 1 - snowMix : snowMix;
      const swap = unwanted > 0.02 && Math.random() < dt * 2 * unwanted;
      if (wasHidden || far || swap || !this.alive[i] || this.py[i] < cam.y - 10) this.respawn(i, cam, wasHidden || far);
      this.py[i] -= this.speed[i] * dt;
      if (this.py[i] <= this.floor[i]) this.alive[i] = 0;
      const x = this.snow[i] ? this.px[i] + Math.sin(time * 1.3 + i) * 0.3 : this.px[i];
      const z = this.snow[i] ? this.pz[i] + Math.cos(time * 1.1 + i * 0.7) * 0.3 : this.pz[i];
      const visible = this.alive[i] === 1;
      if (this.snow[i] || !visible) {
        rp[j + 1] = rp[j + 4] = -1000;
      } else {
        rp[j] = rp[j + 3] = x;
        rp[j + 2] = rp[j + 5] = z;
        rp[j + 1] = this.py[i];
        rp[j + 4] = Math.max(this.floor[i], this.py[i] + 0.7);
      }
      if (!this.snow[i] || !visible) {
        sp[k + 1] = -1000;
      } else {
        sp[k] = x;
        sp[k + 1] = this.py[i];
        sp[k + 2] = z;
      }
    }
    (this.rainGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.snowGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    const l = 0.25 + 0.75 * light;
    this.rainMat.color.setRGB(0.5 * l, 0.62 * l, 0.85 * l);
    this.snowMat.color.setRGB(l, l, l);
  }

  clear() {
    this.alive.fill(0);
    this.cache.clear();
    this.group.visible = false;
  }
}

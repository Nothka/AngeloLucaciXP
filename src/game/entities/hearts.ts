import * as THREE from "three";

const HEART = [".xx.xx.", "xyxxxxx", "xxxxxxx", ".xxxxx.", "..xxx..", "...x..."];

function heartTexture() {
  const c = document.createElement("canvas");
  c.width = 7;
  c.height = 6;
  const g = c.getContext("2d")!;
  HEART.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    g.fillStyle = ch === "y" ? "#ff9bb0" : "#e0213f";
    g.fillRect(x, y, 1, 1);
  }));
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Heart {
  sprite: THREE.Sprite;
  age: number;
}

const LIFE = 1.2;

/** Little hearts drifting up from animals in love. */
export class HeartParticles {
  readonly group = new THREE.Group();
  private material: THREE.SpriteMaterial | null = null;
  private live: Heart[] = [];

  emit(x: number, y: number, z: number) {
    this.material ??= new THREE.SpriteMaterial({ map: heartTexture(), transparent: true, depthWrite: false });
    if (this.live.length > 80) return;
    const sprite = new THREE.Sprite(this.material.clone());
    sprite.scale.set(0.3, 0.26, 1);
    sprite.position.set(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6);
    this.group.add(sprite);
    this.live.push({ sprite, age: 0 });
  }

  update(dt: number) {
    for (const h of [...this.live]) {
      h.age += dt;
      h.sprite.position.y += dt * 0.5;
      (h.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, (LIFE - h.age) / 0.4);
      if (h.age >= LIFE) {
        this.group.remove(h.sprite);
        (h.sprite.material as THREE.SpriteMaterial).dispose();
        this.live.splice(this.live.indexOf(h), 1);
      }
    }
  }

  clear() {
    for (const h of this.live) {
      this.group.remove(h.sprite);
      (h.sprite.material as THREE.SpriteMaterial).dispose();
    }
    this.live = [];
  }
}

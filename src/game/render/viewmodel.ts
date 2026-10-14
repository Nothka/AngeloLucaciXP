import * as THREE from "three";
import { Pixels } from "./textures";
import { createItemModel, type ItemModel } from "./itemMeshes";
import { isFlatItem } from "./items";
import { getItem } from "../world/blocks";

/** First-person arm / held item, rendered in its own scene on top of the world. */
export class ViewModel {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
  private pivot = new THREE.Group();
  private arm: THREE.Mesh;
  private armMaterial: THREE.MeshBasicMaterial;
  private model: ItemModel | null = null;
  private heldId = -1;
  private swing = 1;
  private equip = 1;
  private pendingId = 0;

  constructor(private entityMaterial: () => THREE.ShaderMaterial) {
    const skin = new Pixels(8, 8);
    skin.fill((x, y) => ((x * 7 + y * 3) % 5 === 0 ? "#c28e6c" : y > 5 ? "#b5805f" : "#d39f7b"));
    const tex = new THREE.CanvasTexture(skin.toCanvas());
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.armMaterial = new THREE.MeshBasicMaterial({ map: tex });
    this.arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.9), this.armMaterial);
    this.scene.add(this.pivot);
  }

  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  startSwing() {
    if (this.swing > 0.5) this.swing = 0;
  }

  setHeld(id: number) {
    if (this.heldId === -1) {
      this.rebuild(id);
      this.pendingId = id;
      this.equip = 1;
      return;
    }
    if (id === this.pendingId) return;
    this.pendingId = id;
    // Mid-animation changes are picked up when the current lowering finishes.
    if (this.equip >= 1) this.equip = 0;
  }

  private rebuild(id: number) {
    this.pivot.clear();
    this.model?.dispose();
    this.model = null;
    this.heldId = id;
    if (!id || !getItem(id)) {
      this.arm.position.set(0, 0, 0);
      this.arm.rotation.set(0, 0, 0);
      this.pivot.add(this.arm);
      return;
    }
    this.model = createItemModel(id, this.entityMaterial);
    const obj = this.model.object;
    if (isFlatItem(id)) {
      // Turned about 40 degrees so the flat side faces the camera, like a held tool.
      obj.scale.setScalar(0.52);
      obj.rotation.set(0.15, -0.75, 0.55);
      obj.position.set(0.02, 0.1, 0);
    } else {
      obj.scale.setScalar(0.36);
      obj.rotation.set(0, Math.PI / 4, 0);
    }
    this.pivot.add(obj);
  }

  update(dt: number, walkDist: number, bobbing: boolean, light: number, daylight: number, eating = 0, bowPower = 0) {
    this.swing = Math.min(1, this.swing + dt / 0.3);
    if (this.equip < 1) {
      const before = this.equip;
      this.equip = Math.min(1, this.equip + dt / 0.25);
      // Swap models at the bottom of the equip animation.
      if (before < 0.5 && this.equip >= 0.5) this.rebuild(this.pendingId);
      if (this.equip >= 1 && this.heldId !== this.pendingId) this.equip = 0;
    }
    const down = this.equip < 0.5 ? this.equip * 2 : (1 - this.equip) * 2;

    const s = this.swing;
    const swingArc = Math.sin(s * Math.PI);
    const swingRoot = Math.sin(Math.sqrt(s) * Math.PI);
    const bobX = bobbing ? Math.sin(walkDist * Math.PI) * 0.035 : 0;
    const bobY = bobbing ? -Math.abs(Math.cos(walkDist * Math.PI)) * 0.04 : 0;

    const hasItem = !!this.model;
    const flat = hasItem && isFlatItem(this.heldId);
    const base = hasItem ? (flat ? [0.5, -0.5, -0.85] : [0.55, -0.5, -0.8]) : [0.62, -0.62, -0.7];
    this.pivot.position.set(
      base[0] + bobX - swingRoot * 0.25,
      base[1] + bobY + swingRoot * 0.12 - swingArc * 0.12 - down * 0.6,
      base[2] - swingArc * 0.15,
    );
    if (bowPower > 0) {
      // Bow drawn: pulled toward the middle of the view, trembling at full draw.
      const t = Math.min(1, bowPower * 3);
      const shake = bowPower >= 1 ? Math.sin(performance.now() / 25) * 0.006 : 0;
      this.pivot.position.x -= 0.42 * t;
      this.pivot.position.y += 0.22 * t + shake;
      this.pivot.position.z += 0.05 * t + bowPower * 0.1;
      // Stand the bow upright and turn it side-on to the view, string toward the eye.
      this.pivot.rotation.set(0.05 * t, 0.55 * t, 0.75 * t);
    } else if (eating > 0) {
      // Bring the food up to the mouth and chew.
      const t = Math.min(1, eating * 5);
      this.pivot.position.x -= 0.32 * t;
      this.pivot.position.y += 0.2 * t + Math.abs(Math.sin(eating * 40)) * 0.04 * t;
      this.pivot.position.z += 0.15 * t;
      this.pivot.rotation.set(0.2 * t, 0.5 * t, -0.2 * t);
    } else if (hasItem) {
      this.pivot.rotation.set(-swingArc * 0.6, -swingRoot * 0.35, swingArc * 0.2);
    } else {
      this.pivot.rotation.set(0.35 - swingArc * 0.9, 0.25 - swingRoot * 0.4, -0.2);
    }
    this.model?.setLight(light, daylight);
    const sky = ((light >> 4) / 15) * daylight;
    const v = Math.min(1, 0.15 + Math.max(sky, (light & 15) / 15) * 0.85);
    this.armMaterial.color.setRGB(v, v, v, THREE.SRGBColorSpace);
  }
}

import * as THREE from "three";
import { blockBounds } from "../player/raycast";
import { createCrackTextures } from "./textures";

/** Thin outline around the targeted block plus the progressive crack overlay. */
export class SelectionBox {
  readonly group = new THREE.Group();
  private outline: THREE.LineSegments;
  private crack: THREE.Mesh;
  private crackTextures: THREE.Texture[];
  private crackMaterial: THREE.MeshBasicMaterial;

  constructor() {
    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    this.outline = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    this.crackTextures = createCrackTextures();
    for (const t of this.crackTextures) t.colorSpace = THREE.SRGBColorSpace;
    // dst * src * 2: mid-grey leaves the block untouched, darker pixels carve the cracks.
    this.crackMaterial = new THREE.MeshBasicMaterial({
      map: this.crackTextures[0],
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.SrcColorFactor,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
    });
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.crackMaterial);
    this.crack.renderOrder = 3;
    this.outline.renderOrder = 4;
    this.group.add(this.outline, this.crack);
    this.group.visible = false;
  }

  show(x: number, y: number, z: number, id: number, progress: number) {
    const b = blockBounds(id);
    const pad = 0.002;
    const sx = b[3] - b[0] + pad * 2;
    const sy = b[4] - b[1] + pad * 2;
    const sz = b[5] - b[2] + pad * 2;
    const cx = x + (b[0] + b[3]) / 2;
    const cy = y + (b[1] + b[4]) / 2;
    const cz = z + (b[2] + b[5]) / 2;
    this.outline.position.set(cx, cy, cz);
    this.outline.scale.set(sx, sy, sz);
    this.crack.position.set(cx, cy, cz);
    this.crack.scale.set(sx, sy, sz);
    this.crack.visible = progress > 0;
    if (progress > 0) {
      const stage = Math.min(9, Math.floor(progress * 10));
      if (this.crackMaterial.map !== this.crackTextures[stage]) {
        this.crackMaterial.map = this.crackTextures[stage];
        this.crackMaterial.needsUpdate = true;
      }
    }
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }
}

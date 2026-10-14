import * as THREE from "three";
import { MeshBuilder, emitBox } from "../mesher/mesher";
import { BLOCKS, getItem } from "../world/blocks";
import { isFlatItem, itemSprite } from "./items";

/**
 * 3D models for items held in hand or lying on the ground: block items are
 * real little cubes; flat items are their sprite extruded one pixel deep.
 */

const blockGeometryCache = new Map<number, THREE.BufferGeometry>();
const flatGeometryCache = new Map<number, THREE.BufferGeometry>();
const flatTextureCache = new Map<number, THREE.Texture>();

export function blockItemGeometry(blockId: number): THREE.BufferGeometry {
  let geo = blockGeometryCache.get(blockId);
  if (geo) return geo;
  const def = BLOCKS[blockId];
  const t = def.tiles;
  const front = t.front ?? t.side;
  const layers = [front, t.side, t.top, t.bottom, front, t.side];
  const b = new MeshBuilder();
  emitBox(b, 0, 0, 0, [0, 0, 0], [16, 16, 16], layers, 15, 0);
  const data = b.finish();
  geo = new THREE.BufferGeometry();
  geo.setAttribute("a_pos", new THREE.BufferAttribute(data.pos, 4));
  geo.setAttribute("a_uv", new THREE.BufferAttribute(data.uv, 2));
  geo.setAttribute("a_light", new THREE.BufferAttribute(data.light, 4));
  geo.setIndex(new THREE.BufferAttribute(data.index, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.5, 0.5, 0.5), 0.9);
  blockGeometryCache.set(blockId, geo);
  return geo;
}

export function flatItemTexture(id: number): THREE.Texture {
  let tex = flatTextureCache.get(id);
  if (tex) return tex;
  tex = new THREE.CanvasTexture(itemSprite(id).toCanvas());
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  flatTextureCache.set(id, tex);
  return tex;
}

/** Unit-sized (1 x 1 x 1/16) extruded sprite centred on the origin. */
export function flatItemGeometry(id: number): THREE.BufferGeometry {
  let geo = flatGeometryCache.get(id);
  if (geo) return geo;
  const sprite = itemSprite(id);
  const pos: number[] = [];
  const uv: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const d = 1 / 32;
  const quad = (a: number[], b: number[], c: number[], e: number[], uvs: number[][], shade: number) => {
    const base = pos.length / 3;
    for (const [p, t] of [[a, uvs[0]], [b, uvs[1]], [c, uvs[2]], [e, uvs[3]]] as [number[], number[]][]) {
      pos.push(p[0], p[1], p[2]);
      uv.push(t[0], t[1]);
      col.push(shade, shade, shade);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  // Front and back planes; transparent texels are cut by alphaTest.
  quad([-0.5, -0.5, d], [0.5, -0.5, d], [0.5, 0.5, d], [-0.5, 0.5, d], [[0, 0], [1, 0], [1, 1], [0, 1]], 1);
  quad([0.5, -0.5, -d], [-0.5, -0.5, -d], [-0.5, 0.5, -d], [0.5, 0.5, -d], [[1, 0], [0, 0], [0, 1], [1, 1]], 0.8);
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < 16 && y < 16 && sprite.alpha(x, y) > 128;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (!solid(x, y)) continue;
      const x0 = x / 16 - 0.5, x1 = (x + 1) / 16 - 0.5;
      const y0 = 0.5 - (y + 1) / 16, y1 = 0.5 - y / 16;
      const cu = (x + 0.5) / 16;
      const cv = 1 - (y + 0.5) / 16;
      const t = [[cu, cv], [cu, cv], [cu, cv], [cu, cv]];
      if (!solid(x, y - 1)) quad([x0, y1, d], [x1, y1, d], [x1, y1, -d], [x0, y1, -d], t, 0.9);
      if (!solid(x, y + 1)) quad([x0, y0, -d], [x1, y0, -d], [x1, y0, d], [x0, y0, d], t, 0.6);
      if (!solid(x - 1, y)) quad([x0, y0, -d], [x0, y0, d], [x0, y1, d], [x0, y1, -d], t, 0.7);
      if (!solid(x + 1, y)) quad([x1, y0, d], [x1, y0, -d], [x1, y1, -d], [x1, y1, d], t, 0.7);
    }
  }
  geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  flatGeometryCache.set(id, geo);
  return geo;
}

export interface ItemModel {
  object: THREE.Object3D;
  /** Sets brightness from packed light and the current daylight factor. */
  setLight(packed: number, daylight: number): void;
  dispose(): void;
}

const curve = (f: number) => {
  const b = f / (4 - 3 * f);
  return b + (f - b) * 0.4;
};

/** Builds a fresh model of `id`; `entityMaterial` makes the per-instance block material. */
export function createItemModel(id: number, entityMaterial: () => THREE.ShaderMaterial): ItemModel {
  const item = getItem(id);
  if (item?.block !== undefined && !isFlatItem(id)) {
    const material = entityMaterial();
    const mesh = new THREE.Mesh(blockItemGeometry(item.block), material);
    mesh.position.set(-0.5, -0.5, -0.5);
    mesh.frustumCulled = false;
    const object = new THREE.Group();
    object.add(mesh);
    return {
      object,
      setLight(packed) {
        (material.uniforms.u_lightOverride.value as THREE.Vector2).set((packed >> 4) / 15, (packed & 15) / 15);
      },
      dispose() {
        material.dispose();
      },
    };
  }
  const material = new THREE.MeshBasicMaterial({
    map: flatItemTexture(id),
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    vertexColors: true,
  });
  const mesh = new THREE.Mesh(flatItemGeometry(id), material);
  mesh.frustumCulled = false;
  const object = new THREE.Group();
  object.add(mesh);
  return {
    object,
    setLight(packed, daylight) {
      const sky = curve(((packed >> 4) / 15) * daylight);
      const blk = curve((packed & 15) / 15);
      const v = Math.min(1, Math.max(sky, blk) + 0.03);
      material.color.setRGB(v, v, v, THREE.SRGBColorSpace);
    },
    dispose() {
      material.dispose();
    },
  };
}

import * as THREE from "three";
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex } from "../config";
import type { MeshData } from "../mesher/mesher";

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  /** Packed (sky << 4 | block) light from the last mesh pass; null until meshed. */
  light: Uint8Array | null = null;
  solidMesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  needsMesh = true;
  /** Remesh ahead of everything else (player edits). */
  urgent = false;
  meshing = false;
  meshSeq = 0;
  appliedSeq = 0;
  /** Has edits not yet written to the save. */
  unsaved = false;

  constructor(cx: number, cz: number, blocks: Uint8Array) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = blocks;
  }

  get(x: number, y: number, z: number) {
    if (y < 0 || y >= CHUNK_HEIGHT) return 0;
    return this.blocks[blockIndex(x, y, z)];
  }

  setMeshes(solid: MeshData, water: MeshData, materials: { solid: THREE.Material; water: THREE.Material }, group: THREE.Group) {
    this.solidMesh = applyMesh(this.solidMesh, solid, materials.solid, group, this, 0);
    this.waterMesh = applyMesh(this.waterMesh, water, materials.water, group, this, 1);
  }

  disposeMeshes(group: THREE.Group) {
    for (const mesh of [this.solidMesh, this.waterMesh]) {
      if (!mesh) continue;
      group.remove(mesh);
      mesh.geometry.dispose();
    }
    this.solidMesh = null;
    this.waterMesh = null;
  }
}

const SPHERE = new THREE.Sphere(new THREE.Vector3(CHUNK_SIZE / 2, CHUNK_HEIGHT / 2, CHUNK_SIZE / 2), Math.hypot(8, 64, 8));
const BOX = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE));

function applyMesh(
  existing: THREE.Mesh | null,
  data: MeshData,
  material: THREE.Material,
  group: THREE.Group,
  chunk: Chunk,
  renderOrder: number,
): THREE.Mesh | null {
  if (data.index.length === 0) {
    if (existing) {
      group.remove(existing);
      existing.geometry.dispose();
    }
    return null;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("a_pos", new THREE.BufferAttribute(data.pos, 4));
  geometry.setAttribute("a_uv", new THREE.BufferAttribute(data.uv, 2));
  geometry.setAttribute("a_light", new THREE.BufferAttribute(data.light, 4));
  geometry.setIndex(new THREE.BufferAttribute(data.index, 1));
  geometry.boundingSphere = SPHERE.clone();
  geometry.boundingBox = BOX.clone();
  if (existing) {
    existing.geometry.dispose();
    existing.geometry = geometry;
    return existing;
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  mesh.renderOrder = renderOrder;
  group.add(mesh);
  return mesh;
}

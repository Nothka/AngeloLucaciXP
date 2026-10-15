import * as THREE from "three";
import { CHUNK_HEIGHT, CHUNK_SIZE, blockIndex, chunkKey } from "../config";
import type { WorkerPool } from "../mesher/pool";
import type { WorkerResponse } from "../mesher/worker";
import { EMIT, LIGHT_OPACITY } from "./blocks";
import { Chunk } from "./chunk";
import { TerrainGenerator } from "./terrain";

export interface ChunkStore {
  has(cx: number, cz: number): boolean;
  load(cx: number, cz: number): Promise<Uint8Array | null>;
  save(chunk: Chunk): void;
}

const floorDiv = (a: number, b: number) => Math.floor(a / b);
const mod = (a: number, b: number) => ((a % b) + b) % b;

export class World {
  readonly seed: number;
  readonly generator: TerrainGenerator;
  readonly chunks = new Map<string, Chunk>();
  readonly group = new THREE.Group();
  renderDistance = 8;
  /** Fired after any successful block change (player edits and fluid flow alike). */
  onBlockChange: ((x: number, y: number, z: number, before: number, after: number) => void) | null = null;
  /** A chunk's blocks became available (generated or loaded from the save). */
  onChunkLoaded: ((chunk: Chunk) => void) | null = null;
  /** A chunk is about to leave memory. */
  onChunkUnloaded: ((chunk: Chunk) => void) | null = null;
  stats = { genMs: 0, meshMs: 0, gens: 0, meshes: 0 };

  private loading = new Set<string>();
  private offsets: [number, number][] = [];
  private offsetsFor = -1;
  private disposed = false;

  constructor(
    seed: number,
    private pool: WorkerPool,
    private materials: { solid: THREE.Material; water: THREE.Material },
    private store: ChunkStore | null,
  ) {
    this.seed = seed;
    this.generator = new TerrainGenerator(seed);
    this.group.name = "chunks";
  }

  chunkAt(cx: number, cz: number) {
    return this.chunks.get(chunkKey(cx, cz));
  }

  getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return 0;
    const chunk = this.chunks.get(chunkKey(floorDiv(wx, CHUNK_SIZE), floorDiv(wz, CHUNK_SIZE)));
    if (!chunk) return 0;
    return chunk.blocks[blockIndex(mod(wx, CHUNK_SIZE), wy, mod(wz, CHUNK_SIZE))];
  }

  isLoaded(wx: number, wz: number) {
    return this.chunks.has(chunkKey(floorDiv(wx, CHUNK_SIZE), floorDiv(wz, CHUNK_SIZE)));
  }

  /** Packed light (sky << 4 | block) at a world position; full sky where unknown. */
  getLight(wx: number, wy: number, wz: number): number {
    if (wy >= CHUNK_HEIGHT) return 0xf0;
    if (wy < 0) return 0;
    const chunk = this.chunks.get(chunkKey(floorDiv(wx, CHUNK_SIZE), floorDiv(wz, CHUNK_SIZE)));
    if (!chunk?.light) return 0xf0;
    return chunk.light[blockIndex(mod(wx, CHUNK_SIZE), wy, mod(wz, CHUNK_SIZE))];
  }

  setBlock(wx: number, wy: number, wz: number, id: number): boolean {
    if (wy < 0 || wy >= CHUNK_HEIGHT) return false;
    const cx = floorDiv(wx, CHUNK_SIZE);
    const cz = floorDiv(wz, CHUNK_SIZE);
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (!chunk) return false;
    const lx = mod(wx, CHUNK_SIZE);
    const lz = mod(wz, CHUNK_SIZE);
    const i = blockIndex(lx, wy, lz);
    const before = chunk.blocks[i];
    if (before === id) return false;
    chunk.blocks[i] = id;
    chunk.unsaved = true;
    chunk.needsMesh = true;
    chunk.urgent = true;
    // Light can reach 15 blocks, so every neighbour may need a relight; the
    // ones sharing the edited edge also need their border faces fixed now.
    // When the light cannot change (same opacity and glow, e.g. snow settling,
    // dust powering up), only the neighbours sharing that edge are redrawn.
    const lightSame = LIGHT_OPACITY[before] === LIGHT_OPACITY[id] && EMIT[before] === EMIT[id];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const n = this.chunks.get(chunkKey(cx + dx, cz + dz));
        if (!n) continue;
        const touchesX = dx === 0 ? true : dx < 0 ? lx === 0 : lx === CHUNK_SIZE - 1;
        const touchesZ = dz === 0 ? true : dz < 0 ? lz === 0 : lz === CHUNK_SIZE - 1;
        const touches = touchesX && touchesZ;
        if (!touches && lightSame) continue;
        n.needsMesh = true;
        if (touches) n.urgent = true;
      }
    }
    this.onBlockChange?.(wx, wy, wz, before, id);
    return true;
  }

  /**
   * Generation reaches one ring beyond the meshed circle, including the
   * diagonal neighbours of its edge chunks, which every mesh pass needs.
   */
  private ensureOffsets() {
    const rd = this.renderDistance;
    if (this.offsetsFor === rd) return;
    const r = rd + 2;
    const limit = (rd + 0.5 + Math.SQRT2) ** 2;
    const list: [number, number][] = [];
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dz * dz <= limit) list.push([dx, dz]);
      }
    }
    list.sort((a, b) => a[0] * a[0] + a[1] * a[1] - (b[0] * b[0] + b[1] * b[1]));
    this.offsets = list;
    this.offsetsFor = rd;
  }

  /** Streams chunks around (px, pz): generate, mesh, and unload, nearest first. */
  update(px: number, pz: number) {
    if (this.disposed) return;
    this.ensureOffsets();
    const pcx = floorDiv(Math.floor(px), CHUNK_SIZE);
    const pcz = floorDiv(Math.floor(pz), CHUNK_SIZE);
    const rd = this.renderDistance;
    const meshR2 = (rd + 0.5) * (rd + 0.5);

    // Urgent remeshes first so edits show up within a frame or two.
    for (const chunk of this.chunks.values()) {
      if (this.pool.freeSlots <= 0) break;
      if (chunk.urgent && chunk.needsMesh && !chunk.meshing) this.dispatchMesh(chunk);
    }

    const maxLoading = this.pool.size * 2 + 2;
    for (const [dx, dz] of this.offsets) {
      if (this.pool.freeSlots <= 0) break;
      const cx = pcx + dx;
      const cz = pcz + dz;
      const key = chunkKey(cx, cz);
      const chunk = this.chunks.get(key);
      if (!chunk) {
        if (!this.loading.has(key) && this.loading.size < maxLoading) this.loadChunk(cx, cz, key);
        continue;
      }
      if (chunk.needsMesh && !chunk.meshing && dx * dx + dz * dz <= meshR2 && this.hasNeighbours(cx, cz)) {
        this.dispatchMesh(chunk);
      }
    }

    const keep = (rd + 3) * (rd + 3);
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - pcx;
      const dz = chunk.cz - pcz;
      if (dx * dx + dz * dz > keep) {
        if (chunk.unsaved) this.store?.save(chunk);
        this.onChunkUnloaded?.(chunk);
        chunk.disposeMeshes(this.group);
        this.chunks.delete(key);
      } else if (dx * dx + dz * dz > meshR2 && chunk.solidMesh) {
        chunk.disposeMeshes(this.group);
        chunk.needsMesh = true;
      }
    }
  }

  private hasNeighbours(cx: number, cz: number) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!this.chunks.has(chunkKey(cx + dx, cz + dz))) return false;
      }
    }
    return true;
  }

  private async loadChunk(cx: number, cz: number, key: string) {
    this.loading.add(key);
    try {
      let blocks: Uint8Array | null = null;
      if (this.store?.has(cx, cz)) blocks = await this.store.load(cx, cz);
      if (!blocks) {
        const res = (await this.pool.run({ type: "gen", seed: this.seed, cx, cz })) as Extract<WorkerResponse, { type: "gen" }>;
        blocks = res.blocks;
        this.stats.genMs = this.stats.genMs * 0.9 + res.ms * 0.1;
        this.stats.gens++;
      }
      if (this.disposed || this.chunks.has(key)) return;
      const chunk = new Chunk(cx, cz, blocks);
      this.chunks.set(key, chunk);
      this.onChunkLoaded?.(chunk);
    } finally {
      this.loading.delete(key);
    }
  }

  private dispatchMesh(chunk: Chunk) {
    const chunks: Uint8Array[] = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const n = this.chunks.get(chunkKey(chunk.cx + dx, chunk.cz + dz));
        if (!n) return;
        chunks.push(n.blocks.slice());
      }
    }
    chunk.needsMesh = false;
    chunk.urgent = false;
    chunk.meshing = true;
    const seq = ++chunk.meshSeq;
    this.pool
      .run({ type: "mesh", cx: chunk.cx, cz: chunk.cz, chunks }, chunks.map((c) => c.buffer))
      .then((raw) => {
        chunk.meshing = false;
        const res = raw as Extract<WorkerResponse, { type: "mesh" }>;
        if (this.disposed || this.chunks.get(chunkKey(chunk.cx, chunk.cz)) !== chunk) return;
        if (seq < chunk.appliedSeq) return;
        chunk.appliedSeq = seq;
        chunk.light = res.light;
        chunk.setMeshes(res.solid, res.water, this.materials, this.group);
        this.stats.meshMs = this.stats.meshMs * 0.9 + res.ms * 0.1;
        this.stats.meshes++;
      });
  }

  /** How many chunks within `radius` of the given position already have a mesh pass. */
  readyAround(px: number, pz: number, radius: number) {
    const pcx = floorDiv(Math.floor(px), CHUNK_SIZE);
    const pcz = floorDiv(Math.floor(pz), CHUNK_SIZE);
    let ready = 0;
    let total = 0;
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        total++;
        const c = this.chunks.get(chunkKey(pcx + dx, pcz + dz));
        if (c?.light) ready++;
      }
    }
    return { ready, total };
  }

  unsavedChunks(): Chunk[] {
    return [...this.chunks.values()].filter((c) => c.unsaved);
  }

  dispose() {
    this.disposed = true;
    for (const chunk of this.chunks.values()) chunk.disposeMeshes(this.group);
    this.chunks.clear();
  }
}

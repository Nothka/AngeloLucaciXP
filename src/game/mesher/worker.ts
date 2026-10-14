/// <reference lib="webworker" />
import { TerrainGenerator } from "../world/terrain";
import { RV, buildRegion, computeLight, extractCenterLight } from "../world/lighting";
import { meshChunk } from "./mesher";

export type WorkerRequest =
  | { type: "gen"; id: number; seed: number; cx: number; cz: number }
  | { type: "mesh"; id: number; cx: number; cz: number; chunks: Uint8Array[] };

export type WorkerResponse =
  | { type: "gen"; id: number; cx: number; cz: number; blocks: Uint8Array; ms: number }
  | {
      type: "mesh";
      id: number;
      cx: number;
      cz: number;
      solid: import("./mesher").MeshData;
      water: import("./mesher").MeshData;
      light: Uint8Array;
      ms: number;
    };

const region = new Uint8Array(RV);
const sky = new Uint8Array(RV);
const blk = new Uint8Array(RV);
let generator: TerrainGenerator | null = null;

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  const start = performance.now();
  if (msg.type === "gen") {
    if (!generator || generator.seed !== msg.seed) generator = new TerrainGenerator(msg.seed);
    const blocks = generator.generate(msg.cx, msg.cz);
    const res: WorkerResponse = { type: "gen", id: msg.id, cx: msg.cx, cz: msg.cz, blocks, ms: performance.now() - start };
    (self as unknown as Worker).postMessage(res, [blocks.buffer]);
    return;
  }
  buildRegion(msg.chunks, region);
  computeLight(region, sky, blk);
  const meshes = meshChunk(region, sky, blk);
  const light = extractCenterLight(sky, blk);
  const res: WorkerResponse = {
    type: "mesh",
    id: msg.id,
    cx: msg.cx,
    cz: msg.cz,
    solid: meshes.solid,
    water: meshes.water,
    light,
    ms: performance.now() - start,
  };
  const transfer: Transferable[] = [light.buffer];
  for (const m of [meshes.solid, meshes.water]) transfer.push(m.pos.buffer, m.uv.buffer, m.light.buffer, m.index.buffer);
  (self as unknown as Worker).postMessage(res, transfer);
};

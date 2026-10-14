import type { WorkerRequest, WorkerResponse } from "./worker";

type Pending = (res: WorkerResponse) => void;
type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

/** Fixed pool of generation/meshing workers; each worker takes up to two jobs at a time. */
export class WorkerPool {
  private workers: { worker: Worker; busy: number }[] = [];
  private callbacks = new Map<number, Pending>();
  private nextId = 1;
  readonly perWorker = 2;

  constructor(count: number) {
    for (let i = 0; i < count; i++) {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      const slot = { worker, busy: 0 };
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        slot.busy--;
        const cb = this.callbacks.get(event.data.id);
        this.callbacks.delete(event.data.id);
        cb?.(event.data);
      };
      worker.onerror = (event) => console.error("[blockvale] worker error", event.message);
      this.workers.push(slot);
    }
  }

  get size() {
    return this.workers.length;
  }

  get freeSlots() {
    let free = 0;
    for (const w of this.workers) free += this.perWorker - w.busy;
    return free;
  }

  run(request: DistributiveOmit<WorkerRequest, "id">, transfer: Transferable[] = []): Promise<WorkerResponse> {
    let best = this.workers[0];
    for (const w of this.workers) if (w.busy < best.busy) best = w;
    const id = this.nextId++;
    best.busy++;
    return new Promise((resolve) => {
      this.callbacks.set(id, resolve);
      best.worker.postMessage({ ...request, id }, transfer);
    });
  }

  dispose() {
    for (const w of this.workers) w.worker.terminate();
    this.workers = [];
    this.callbacks.clear();
  }
}

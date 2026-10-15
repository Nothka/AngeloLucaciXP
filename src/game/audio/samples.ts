import { prepareSample, splitCalls, type PrepareOptions } from "./sampleProcessing";

/**
 * Recorded sounds (all CC0, see sounds/CREDITS.md), grouped as
 * "<folder>/<event>" from their file names: sounds/cow/idle-513557.mp3 is
 * one take of "cow/idle", sounds/block/stone_dig-impactMining_000.wav one
 * of "block/stone_dig". An event ending in "_calls" holds several calls in
 * one recording, which are split into separate takes of the event.
 */
const FILES = import.meta.glob("./sounds/*/*.{mp3,wav}", { query: "?url", import: "default", eager: true }) as Record<string, string>;

interface Source {
  url: string;
  split: boolean;
}

const GROUPS = new Map<string, Source[]>();
for (const [path, url] of Object.entries(FILES)) {
  const m = path.match(/\.\/sounds\/([^/]+)\/([a-z_]+)-[^/]+\.(mp3|wav)$/);
  if (!m) continue;
  const split = m[2].endsWith("_calls");
  const key = `${m[1]}/${split ? m[2].slice(0, -"_calls".length) : m[2]}`;
  GROUPS.set(key, [...(GROUPS.get(key) ?? []), { url, split }]);
}

/** Folders holding mob voices: these are shortened a little and borrow related events. */
const MOB_FOLDERS = new Set(["cow", "pig", "sheep", "chicken", "zombie", "skeleton", "spider"]);

/** Share of each trimmed mob call that is played: the calls felt a little long at full length. */
export const CLIP_KEEP = 0.8;

/** Mob events without recordings of their own borrow a related one (a sheep's hurt sound is a short baa). */
const FALLBACK: Record<string, string> = { death: "hurt", hurt: "idle" };

export class SampleBank {
  private buffers = new Map<string, AudioBuffer[]>();
  private last = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;

  /** Fetches and prepares every recording in the background; safe to call repeatedly. */
  load(ctx: BaseAudioContext): Promise<void> {
    this.loading ??= Promise.all(
      [...GROUPS].map(async ([key, sources]) => {
        const [folder, event] = key.split("/");
        const mob = MOB_FOLDERS.has(folder);
        // Mob calls and the player's voice: one call (mob calls shortened a little).
        // Footsteps, impacts and effects keep their whole sound and its tail.
        const opts = mob
          ? { maxSeconds: event === "idle" ? 3 : 2.2, keep: CLIP_KEEP }
          : folder === "player"
            ? { maxSeconds: 1.2, keep: 1 }
            : { maxSeconds: 1.2, keep: 1, threshold: 0.02, oneCall: false };
        const lists = await Promise.all(sources.map((s) => this.fetchOne(ctx, s, opts)));
        this.buffers.set(key, lists.flat());
      }),
    ).then(() => {});
    return this.loading;
  }

  private async fetchOne(ctx: BaseAudioContext, source: Source, opts: PrepareOptions): Promise<AudioBuffer[]> {
    try {
      const data = await (await fetch(source.url)).arrayBuffer();
      const decoded = await ctx.decodeAudioData(data);
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
      const clips = source.split ? splitCalls(channels, decoded.sampleRate, { ...opts, maxSeconds: 1.2 }) : [prepareSample(channels, decoded.sampleRate, opts)];
      return clips.filter((c) => c.length).map((mono) => {
        const buf = ctx.createBuffer(1, mono.length, decoded.sampleRate);
        buf.copyToChannel(mono, 0);
        return buf;
      });
    } catch {
      return [];
    }
  }

  get ready() {
    return this.buffers.size > 0;
  }

  /** A random take of "<folder>/<event>" (never the same one twice in a row), or null. */
  pick(folder: string, event: string): AudioBuffer | null {
    let e: string | undefined = event;
    while (e) {
      const key = `${folder}/${e}`;
      const list = this.buffers.get(key);
      if (list?.length) {
        const prev = this.last.get(key);
        const options = list.length > 1 ? list.filter((b) => b !== prev) : list;
        const choice = options[Math.floor(Math.random() * options.length)];
        this.last.set(key, choice);
        return choice;
      }
      e = MOB_FOLDERS.has(folder) ? FALLBACK[e] : undefined;
    }
    return null;
  }
}

/** Which "<folder>/<event>" groups have recordings (for tests and the debug screen). */
export const recordedGroups = () => [...GROUPS.keys()].sort();

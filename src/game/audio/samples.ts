import { prepareSample } from "./sampleProcessing";

/**
 * Recorded mob sounds (CC0, see sounds/CREDITS.md), grouped by
 * "<mob>/<event>" from their file names, e.g. sounds/cow/idle-513557.mp3.
 */
const FILES = import.meta.glob("./sounds/*/*.mp3", { query: "?url", import: "default", eager: true }) as Record<string, string>;

const GROUPS = new Map<string, string[]>();
for (const [path, url] of Object.entries(FILES)) {
  const m = path.match(/\.\/sounds\/([^/]+)\/([a-z]+)-\d+\.mp3$/);
  if (!m) continue;
  const key = `${m[1]}/${m[2]}`;
  GROUPS.set(key, [...(GROUPS.get(key) ?? []), url]);
}

/** Events without recordings of their own borrow a related one (a sheep's hurt sound is a short baa). */
const FALLBACK: Record<string, string> = { death: "hurt", hurt: "idle" };

export class SampleBank {
  private buffers = new Map<string, AudioBuffer[]>();
  private last = new Map<string, AudioBuffer>();
  private loading: Promise<void> | null = null;

  /** Fetches and prepares every recording in the background; safe to call repeatedly. */
  load(ctx: BaseAudioContext): Promise<void> {
    this.loading ??= Promise.all(
      [...GROUPS].map(async ([key, urls]) => {
        const list = await Promise.all(urls.map((url) => this.fetchOne(ctx, url, key.endsWith("/idle") ? 3 : 2.2)));
        this.buffers.set(key, list.filter((b): b is AudioBuffer => !!b));
      }),
    ).then(() => {});
    return this.loading;
  }

  private async fetchOne(ctx: BaseAudioContext, url: string, maxSeconds: number): Promise<AudioBuffer | null> {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      const decoded = await ctx.decodeAudioData(data);
      const channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i));
      const mono = prepareSample(channels, decoded.sampleRate, { maxSeconds });
      if (!mono.length) return null;
      const buf = ctx.createBuffer(1, mono.length, decoded.sampleRate);
      buf.copyToChannel(mono, 0);
      return buf;
    } catch {
      return null;
    }
  }

  get ready() {
    return this.buffers.size > 0;
  }

  /** A random recording for "<mob>/<event>" (never the same one twice in a row), or null. */
  pick(mob: string, event: string): AudioBuffer | null {
    let e: string | undefined = event;
    while (e) {
      const key = `${mob}/${e}`;
      const list = this.buffers.get(key);
      if (list?.length) {
        const prev = this.last.get(key);
        const options = list.length > 1 ? list.filter((b) => b !== prev) : list;
        const choice = options[Math.floor(Math.random() * options.length)];
        this.last.set(key, choice);
        return choice;
      }
      e = FALLBACK[e];
    }
    return null;
  }
}

/** Which "<mob>/<event>" groups have recordings (for tests and the debug screen). */
export const recordedGroups = () => [...GROUPS.keys()].sort();

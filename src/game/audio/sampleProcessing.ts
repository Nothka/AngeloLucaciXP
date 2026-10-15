/**
 * Cleans up a recorded clip once, when it loads: mix to mono (the stereo
 * panner places it), cut the silence around the sound, cap its length, even
 * out loudness between recordings, and fade the edges so cuts never click.
 */

export interface PrepareOptions {
  /** Longest clip kept, in seconds. */
  maxSeconds?: number;
  /** Target loudness (RMS of the audible part, 0..1). */
  targetRms?: number;
  /** Keep this share of the trimmed call (the rest fades away), e.g. 0.8. */
  keep?: number;
  /** Loudness (share of the loudest moment) that counts as sound rather than silence. */
  threshold?: number;
  /** Stop at the first long pause (animal calls); off for footsteps and impacts, whose tails matter. */
  oneCall?: boolean;
}

const WINDOW_SECONDS = 0.01;

export function prepareSample(channels: Float32Array[], sampleRate: number, opts: PrepareOptions = {}): Float32Array {
  const maxSeconds = opts.maxSeconds ?? 3;
  const targetRms = opts.targetRms ?? 0.16;
  const keep = opts.keep ?? 1;
  const n = channels[0]?.length ?? 0;
  if (!n) return new Float32Array(0);
  const mono = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) mono[i] += ch[i] / channels.length;

  // Loudness per 10 ms window; the sound is wherever it rises well above the noise floor.
  const win = Math.max(1, Math.round(sampleRate * WINDOW_SECONDS));
  const rms: number[] = [];
  for (let w = 0; w < n; w += win) {
    let sum = 0;
    const end = Math.min(n, w + win);
    for (let i = w; i < end; i++) sum += mono[i] * mono[i];
    rms.push(Math.sqrt(sum / (end - w)));
  }
  const loudest = Math.max(...rms);
  if (loudest < 1e-5) return new Float32Array(0);
  const threshold = loudest * (opts.threshold ?? 0.08);
  const oneCall = opts.oneCall ?? true;
  let first = rms.findIndex((v) => v >= threshold);
  // End at the first long pause once the sound has started: one call, not the next one too.
  const GAP = 30; // windows (0.3 s)
  let last = first;
  for (let w = first, quiet = 0; w < rms.length; w++) {
    if (rms[w] >= threshold) {
      last = w;
      quiet = 0;
    } else if (++quiet >= GAP && last - first >= 20 && oneCall) break;
  }
  // Keep a little air either side: the attack and the natural tail.
  first = Math.max(0, first - 2);
  last = Math.min(rms.length - 1, last + 6);
  const start = first * win;
  const full = Math.min(n, (last + 1) * win, start + Math.round(maxSeconds * sampleRate)) - start;
  const end = start + Math.max(win, Math.round(full * keep));
  const out = mono.slice(start, end);

  // Even out loudness across recordings (measured on the audible windows only), without clipping.
  let sum = 0, count = 0, peak = 0;
  for (let w = first; w <= last; w++) if (rms[w] >= threshold) {
    sum += rms[w] * rms[w];
    count++;
  }
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const level = Math.sqrt(sum / Math.max(1, count));
  const gain = Math.min(targetRms / Math.max(level, 1e-6), 0.95 / Math.max(peak, 1e-6));
  const fadeIn = Math.min(out.length >> 1, Math.round(sampleRate * 0.004));
  // A shortened call fades out over its last fifth (up to 0.2 s) so the cut sounds natural.
  const fadeOut = Math.min(out.length >> 1, Math.round(keep < 1 ? Math.min(out.length * 0.2, sampleRate * 0.2) : sampleRate * 0.04));
  for (let i = 0; i < out.length; i++) {
    let g = gain;
    if (i < fadeIn) g *= i / fadeIn;
    if (i >= out.length - fadeOut) g *= (out.length - 1 - i) / fadeOut;
    out[i] *= g;
  }
  return out;
}

/**
 * Splits a recording of several calls (a pig oinking again and again) into
 * one prepared clip per call. Calls are separated by at least `gapSeconds`
 * of quiet; very short blips are skipped.
 */
export function splitCalls(channels: Float32Array[], sampleRate: number, opts: PrepareOptions & { gapSeconds?: number; minSeconds?: number } = {}): Float32Array[] {
  const n = channels[0]?.length ?? 0;
  if (!n) return [];
  const mono = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) mono[i] += ch[i] / channels.length;
  const win = Math.max(1, Math.round(sampleRate * WINDOW_SECONDS));
  const rms: number[] = [];
  for (let w = 0; w < n; w += win) {
    let sum = 0;
    const end = Math.min(n, w + win);
    for (let i = w; i < end; i++) sum += mono[i] * mono[i];
    rms.push(Math.sqrt(sum / (end - w)));
  }
  const threshold = Math.max(...rms) * 0.12;
  const gap = Math.round((opts.gapSeconds ?? 0.08) / WINDOW_SECONDS);
  const minLen = Math.round((opts.minSeconds ?? 0.12) / WINDOW_SECONDS);
  const calls: Float32Array[] = [];
  let start = -1, last = -1;
  const flush = () => {
    if (start >= 0 && last - start + 1 >= minLen) {
      const a = Math.max(0, start - 2) * win, b = Math.min(n, (last + 4) * win);
      const clip = prepareSample([mono.subarray(a, b)], sampleRate, opts);
      if (clip.length) calls.push(clip);
    }
    start = last = -1;
  };
  for (let w = 0; w < rms.length; w++) {
    if (rms[w] >= threshold) {
      if (start < 0) start = w;
      last = w;
    } else if (start >= 0 && w - last >= gap) {
      flush();
    }
  }
  flush();
  return calls;
}

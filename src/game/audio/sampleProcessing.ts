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
}

const WINDOW_SECONDS = 0.01;

export function prepareSample(channels: Float32Array[], sampleRate: number, opts: PrepareOptions = {}): Float32Array {
  const maxSeconds = opts.maxSeconds ?? 3;
  const targetRms = opts.targetRms ?? 0.16;
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
  const threshold = loudest * 0.08;
  let first = rms.findIndex((v) => v >= threshold);
  // End at the first long pause once the sound has started: one call, not the next one too.
  const GAP = 30; // windows (0.3 s)
  let last = first;
  for (let w = first, quiet = 0; w < rms.length; w++) {
    if (rms[w] >= threshold) {
      last = w;
      quiet = 0;
    } else if (++quiet >= GAP && last - first >= 20) break;
  }
  // Keep a little air either side: the attack and the natural tail.
  first = Math.max(0, first - 2);
  last = Math.min(rms.length - 1, last + 6);
  const start = first * win;
  const end = Math.min(n, (last + 1) * win, start + Math.round(maxSeconds * sampleRate));
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
  const fadeOut = Math.min(out.length >> 1, Math.round(sampleRate * 0.04));
  for (let i = 0; i < out.length; i++) {
    let g = gain;
    if (i < fadeIn) g *= i / fadeIn;
    if (i >= out.length - fadeOut) g *= (out.length - 1 - i) / fadeOut;
    out[i] *= g;
  }
  return out;
}

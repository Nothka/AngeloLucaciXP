import type { SoundKind } from "../world/blocks";

type Action = "dig" | "break" | "place" | "step";

interface Recipe {
  filter: BiquadFilterType;
  freq: number;
  q: number;
  /** Seconds of the noise burst. */
  length: number;
  /** Optional tonal knock layered under the noise. */
  tone?: number;
  gain: number;
}

const RECIPES: Record<Exclude<SoundKind, "none">, Recipe> = {
  grass: { filter: "bandpass", freq: 900, q: 0.9, length: 0.16, gain: 0.55 },
  stone: { filter: "bandpass", freq: 2100, q: 1.6, length: 0.09, tone: 140, gain: 0.6 },
  wood: { filter: "bandpass", freq: 520, q: 2.4, length: 0.12, tone: 210, gain: 0.7 },
  sand: { filter: "highpass", freq: 2300, q: 0.7, length: 0.18, gain: 0.35 },
  glass: { filter: "highpass", freq: 3200, q: 0.8, length: 0.12, gain: 0.45 },
  cloth: { filter: "lowpass", freq: 1200, q: 0.6, length: 0.15, gain: 0.45 },
};

const ACTION_SCALE: Record<Action, { gain: number; length: number }> = {
  dig: { gain: 0.45, length: 0.7 },
  break: { gain: 1, length: 1.3 },
  place: { gain: 0.85, length: 0.9 },
  step: { gain: 0.22, length: 0.7 },
};

/** Pentatonic scale degrees (semitones) for the generative ambient music. */
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];

/**
 * All game audio is synthesised with WebAudio: filtered noise for block
 * sounds, short tones for UI, and a slow generative piano-like ambience.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private reverb!: ConvolverNode;
  private noise!: AudioBuffer;
  private musicTimer: number | null = null;
  private volumes = { master: 0.8, music: 0.5 };
  private musicEnabled = false;

  /** Must be called from a user gesture before anything is audible. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.sfx = ctx.createGain();
      this.sfx.connect(this.master);
      this.music = ctx.createGain();
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = this.impulse(3.2);
      this.music.connect(this.reverb);
      this.reverb.connect(this.master);
      const dry = ctx.createGain();
      dry.gain.value = 0.35;
      this.music.connect(dry);
      dry.connect(this.master);
      this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this.musicEnabled) this.scheduleMusic(4);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setVolumes(master: number, music: number) {
    this.volumes = { master: master / 100, music: music / 100 };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.music.gain.value = this.volumes.music * 0.32;
  }

  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  /** `pan` -1..1 and `distance` in blocks give a cheap sense of where a sound came from. */
  block(kind: SoundKind, action: Action, pan = 0, distance = 0) {
    if (!this.ctx || kind === "none") return;
    const ctx = this.ctx;
    const r = RECIPES[kind];
    const a = ACTION_SCALE[action];
    const now = ctx.currentTime;
    const length = r.length * a.length * (0.85 + Math.random() * 0.3);
    const gain = r.gain * a.gain * Math.max(0, 1 - distance / 16);
    if (gain <= 0.01) return;

    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(panner);
    panner.connect(this.sfx);

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const filter = ctx.createBiquadFilter();
    filter.type = r.filter;
    filter.frequency.value = r.freq * (0.85 + Math.random() * 0.3);
    filter.Q.value = r.q;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.006);
    env.gain.exponentialRampToValueAtTime(0.001, now + length);
    src.connect(filter);
    filter.connect(env);
    env.connect(out);
    src.start(now, Math.random() * 0.5, length + 0.05);

    if (r.tone && action !== "step") {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(r.tone * (0.9 + Math.random() * 0.2), now);
      osc.frequency.exponentialRampToValueAtTime(r.tone * 0.6, now + length);
      const tg = ctx.createGain();
      tg.gain.setValueAtTime(gain * 0.5, now);
      tg.gain.exponentialRampToValueAtTime(0.001, now + length * 0.8);
      osc.connect(tg);
      tg.connect(out);
      osc.start(now);
      osc.stop(now + length);
    }
    if (kind === "glass" && action === "break") {
      for (let i = 0; i < 4; i++) this.tone(2400 + Math.random() * 2600, 0.12 + Math.random() * 0.15, 0.06, "sine", now + i * 0.025, out);
    }
  }

  private tone(freq: number, length: number, gain: number, type: OscillatorType, at?: number, dest?: AudioNode, endFreq?: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = at ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, t + length);
    osc.connect(g);
    g.connect(dest ?? this.sfx);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  pickup() {
    this.tone(700 + Math.random() * 300, 0.09, 0.18, "triangle", undefined, undefined, 1500 + Math.random() * 400);
  }

  click() {
    this.tone(1250, 0.045, 0.12, "square");
    this.tone(620, 0.06, 0.08, "triangle");
  }

  craft() {
    this.tone(523, 0.08, 0.1, "triangle");
    this.tone(784, 0.12, 0.08, "triangle", (this.ctx?.currentTime ?? 0) + 0.06);
  }

  achievement(challenge = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = challenge ? [523, 659, 784, 1047, 1319] : [659, 784, 1047];
    notes.forEach((f, i) => this.tone(f, 0.35, 0.09, "triangle", t + i * 0.09));
  }

  /** A short grunt pitched per mob type; deeper and longer when it dies. */
  mobHurt(voice: number, dying = false) {
    if (!this.ctx) return;
    const f = 220 * voice;
    this.tone(f * 1.3, dying ? 0.4 : 0.18, 0.14, "sawtooth", undefined, undefined, f * (dying ? 0.4 : 0.8));
    this.block("cloth", "dig");
  }

  bowShot() {
    if (!this.ctx) return;
    this.tone(520, 0.12, 0.1, "triangle", undefined, undefined, 260);
    this.block("cloth", "step");
  }

  xpOrb() {
    this.tone(900 + Math.random() * 500, 0.07, 0.07, "sine", undefined, undefined, 1400 + Math.random() * 400);
  }

  levelUp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 0.08, "triangle", t + i * 0.07));
  }

  hurt() {
    if (!this.ctx) return;
    this.tone(260, 0.22, 0.22, "square", undefined, undefined, 120);
    this.block("cloth", "break");
  }

  eat() {
    this.block("grass", "dig");
    this.block("sand", "step");
  }

  burp() {
    this.tone(150, 0.3, 0.16, "sawtooth", undefined, undefined, 80);
  }

  splash() {
    this.block("sand", "break");
    this.block("grass", "place");
  }

  /* ------------------------------------------------------------------ music */

  setMusicEnabled(on: boolean) {
    this.musicEnabled = on;
    if (!on) {
      if (this.musicTimer !== null) clearTimeout(this.musicTimer);
      this.musicTimer = null;
    } else if (this.ctx && this.musicTimer === null) {
      this.scheduleMusic(3);
    }
  }

  private scheduleMusic(delaySeconds: number) {
    if (this.musicTimer !== null) clearTimeout(this.musicTimer);
    this.musicTimer = window.setTimeout(() => {
      this.musicTimer = null;
      if (!this.musicEnabled) return;
      const length = this.playPiece();
      this.scheduleMusic(length + 40 + Math.random() * 80);
    }, delaySeconds * 1000);
  }

  /** Plays one short generative phrase; returns its length in seconds. */
  private playPiece(): number {
    if (!this.ctx) return 0;
    const ctx = this.ctx;
    const roots = [48, 50, 53, 55, 57];
    const root = roots[Math.floor(Math.random() * roots.length)];
    let t = ctx.currentTime + 0.2;
    const notes = 14 + Math.floor(Math.random() * 10);
    let degree = Math.floor(Math.random() * 5);
    for (let i = 0; i < notes; i++) {
      degree = Math.max(0, Math.min(SCALE.length - 1, degree + Math.floor(Math.random() * 5) - 2));
      const midi = root + SCALE[degree] + 12;
      this.pianoNote(midi, t, 0.9 + Math.random() * 0.4);
      if (Math.random() < 0.3) this.pianoNote(midi - 12, t, 0.6);
      if (i % 4 === 0) this.pianoNote(root, t, 0.5);
      t += [0.9, 1.2, 1.8, 2.4][Math.floor(Math.random() * 4)];
    }
    return t - ctx.currentTime + 4;
  }

  private pianoNote(midi: number, at: number, velocity: number) {
    const ctx = this.ctx!;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.22 * velocity, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.06 * velocity, at + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0005, at + 3.6);
    g.connect(this.music);
    for (const [mult, type, level] of [[1, "triangle", 1], [2, "sine", 0.35], [3, "sine", 0.12]] as [number, OscillatorType, number][]) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = f * mult * (1 + (Math.random() - 0.5) * 0.002);
      const og = ctx.createGain();
      og.gain.value = level;
      osc.connect(og);
      og.connect(g);
      osc.start(at);
      osc.stop(at + 3.7);
    }
  }
}

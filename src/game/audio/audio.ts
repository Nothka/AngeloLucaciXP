import type { SoundKind } from "../world/blocks";
import { spatialize, type Listener } from "./spatial";
import { SampleBank } from "./samples";

export type MobSound = "idle" | "hurt" | "death" | "eat" | "plop" | "step" | "graze" | "milk";

/** Random pitch for mob voices, as in the classic game: 0.8-1.2 for adults, 1.3-1.7 for babies. */
export const mobPitch = (baby: boolean, rand: () => number = Math.random) => (baby ? 1.3 : 0.8) + rand() * 0.4;

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
  /** Where the ears are: the player's eye and camera yaw, updated every frame. */
  private listener: Listener = { x: 0, y: 0, z: 0, yaw: 0 };
  /** Recorded animal and monster voices; synthesised ones stand in until (or unless) they load. */
  readonly samples = new SampleBank();

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
      void this.samples.load(ctx);
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

  setListener(x: number, y: number, z: number, yaw: number) {
    this.listener.x = x;
    this.listener.y = y;
    this.listener.z = z;
    this.listener.yaw = yaw;
  }

  /**
   * A gain node feeding a stereo panner for a sound at (x, y, z), already
   * scaled for distance; null when it is out of earshot (16 blocks).
   */
  private placed(x: number, y: number, z: number, loudness = 1): GainNode | null {
    if (!this.ctx) return null;
    const at = spatialize(this.listener, x, y, z);
    if (!at || at.volume * loudness < 0.01) return null;
    const out = this.ctx.createGain();
    out.gain.value = at.volume * loudness;
    const panner = this.ctx.createStereoPanner();
    panner.pan.value = at.pan;
    out.connect(panner);
    panner.connect(this.sfx);
    return out;
  }

  /** A block sound at a world position: silent past 16 blocks, louder nearer, panned by direction. */
  blockAt(kind: SoundKind, action: Action, x: number, y: number, z: number, pitch = 1) {
    const at = spatialize(this.listener, x, y, z);
    if (at) this.block(kind, action, at.pan, at.distance, pitch);
  }

  /** `pan` -1..1 and `distance` in blocks give a cheap sense of where a sound came from. */
  block(kind: SoundKind, action: Action, pan = 0, distance = 0, pitch = 1) {
    if (!this.ctx || kind === "none") return;
    const ctx = this.ctx;
    const r = RECIPES[kind];
    const a = ACTION_SCALE[action];
    const now = ctx.currentTime;
    const length = r.length * a.length * (0.85 + Math.random() * 0.3);
    // Linear fall-off to silence at 16 blocks (see spatial.ts).
    const gain = r.gain * a.gain * Math.max(0, 1 - distance / 16);
    if (gain <= 0.01) return;

    const out = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    out.connect(panner);
    panner.connect(this.sfx);

    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = (0.8 + Math.random() * 0.4) * pitch;
    const filter = ctx.createBiquadFilter();
    filter.type = r.filter;
    filter.frequency.value = r.freq * (0.85 + Math.random() * 0.3) * pitch;
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

  /** A short noise burst through a filter, e.g. a crunch, hiss or click. */
  private noiseBurst(dest: AudioNode, at: number, length: number, gain: number, type: BiquadFilterType, freq: number, q = 1) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0005, at + length);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(at, Math.random() * 0.5, length + 0.05);
  }

  /** A voiced call: an oscillator gliding through `freqs`, shaped by a formant filter and optional vibrato. */
  private call(dest: AudioNode, at: number, length: number, gain: number, type: OscillatorType, freqs: number[], formant: number, vibrato = 0) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqs[0], at);
    freqs.slice(1).forEach((f, i) => osc.frequency.exponentialRampToValueAtTime(f, at + (length * (i + 1)) / (freqs.length - 1)));
    if (vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 7;
      const depth = ctx.createGain();
      depth.gain.value = vibrato;
      lfo.connect(depth);
      depth.connect(osc.frequency);
      lfo.start(at);
      lfo.stop(at + length + 0.05);
    }
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = formant;
    f.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + Math.min(0.06, length * 0.2));
    g.gain.setValueAtTime(gain, at + length * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0005, at + length);
    osc.connect(f);
    f.connect(g);
    g.connect(dest);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }

  /**
   * A mob's voice at its position. Babies speak higher; hurt sounds are
   * sharp and high, death sounds longer and falling.
   */
  mobSound(type: string, sound: MobSound, x: number, y: number, z: number, baby = false) {
    if (sound === "step") {
      // Bony clacks and skittering legs on top of the ground's own footstep sound.
      if (type !== "skeleton" && type !== "spider" && type !== "chicken") return;
      const out = this.placed(x, y, z, 0.5);
      if (!out) return;
      const t = this.ctx!.currentTime;
      if (type === "skeleton") for (let i = 0; i < 2; i++) this.noiseBurst(out, t + i * 0.04, 0.025, 0.35, "highpass", 2800);
      else if (type === "spider") for (let i = 0; i < 3; i++) this.noiseBurst(out, t + i * 0.035, 0.02, 0.25, "bandpass", 2200);
      else this.noiseBurst(out, t, 0.03, 0.2, "bandpass", 1800);
      return;
    }
    const out = this.placed(x, y, z);
    if (!out) return;
    const t = this.ctx!.currentTime + 0.01;
    const k = mobPitch(baby);
    // A real recording when there is one, sped up or slowed down for pitch like the classic game does.
    if (sound === "idle" || sound === "hurt" || sound === "death" || sound === "plop") {
      const buf = this.samples.pick(type, sound);
      if (buf) {
        const src = this.ctx!.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = k * (sound === "death" ? 0.9 : 1);
        src.connect(out);
        src.start(t);
        return;
      }
    }
    if (sound === "graze") return; // played as the grass block's break sound
    if (sound === "milk") {
      for (let i = 0; i < 2; i++) this.noiseBurst(out, t + i * 0.18, 0.14, 0.4, "lowpass", 900);
      this.call(out, t, 0.3, 0.2, "sine", [520, 380], 600);
      return;
    }
    if (sound === "eat") {
      for (let i = 0; i < 3; i++) this.noiseBurst(out, t + i * 0.16, 0.09, 0.5, "bandpass", 900 + Math.random() * 400, 0.9);
      return;
    }
    if (sound === "plop") {
      this.call(out, t, 0.14, 0.6, "sine", [320 * k, 90 * k], 300);
      this.noiseBurst(out, t, 0.06, 0.25, "lowpass", 700);
      return;
    }
    const hurt = sound === "hurt";
    const death = sound === "death";
    const len = (base: number) => base * (death ? 1.6 : 1);
    switch (type) {
      case "cow":
        if (hurt || death) this.call(out, t, len(0.35), 0.5, "sawtooth", [210 * k, 150 * k, death ? 90 * k : 140 * k], 650);
        else this.call(out, t, 1.1, 0.42, "sawtooth", [100 * k, 112 * k, 92 * k], 420, 2);
        break;
      case "pig":
        if (hurt || death) this.call(out, t, len(0.32), 0.42, "sawtooth", [620 * k, 900 * k, death ? 380 * k : 560 * k], 1400);
        else for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) this.call(out, t + i * 0.2, 0.12, 0.42, "square", [170 * k, 120 * k], 700);
        break;
      case "sheep":
        this.call(out, t, hurt ? 0.25 : death ? 0.6 : 0.75, 0.42, "sawtooth", hurt || death ? [420 * k, 330 * k] : [290 * k, 300 * k, 270 * k], 950, hurt ? 0 : 16 * k);
        break;
      case "chicken":
        if (hurt || death) this.call(out, t, len(0.16), 0.4, "triangle", [1400 * k, 900 * k], 1600);
        else for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this.call(out, t + i * 0.11, 0.06, 0.35, "triangle", [720 * k, 1150 * k], 1100);
        break;
      case "zombie":
        this.call(out, t, hurt ? 0.3 : death ? 0.9 : 1.2, 0.48, "sawtooth", hurt ? [150, 110] : [82, 70, death ? 45 : 64], 380, 3);
        this.noiseBurst(out, t, hurt ? 0.25 : 0.8, 0.12, "lowpass", 500);
        break;
      case "skeleton":
        for (let i = 0; i < (hurt ? 3 : 6); i++) this.noiseBurst(out, t + i * 0.045, 0.03, 0.45, "highpass", 2600 + Math.random() * 1500);
        if (hurt || death) this.call(out, t, len(0.2), 0.2, "square", [500, 300], 900);
        break;
      case "spider":
        this.noiseBurst(out, t, hurt ? 0.18 : death ? 0.5 : 0.55, 0.38, "highpass", 3200, 0.7);
        for (let i = 0; i < 3; i++) this.noiseBurst(out, t + 0.08 + i * 0.07, 0.03, 0.3, "bandpass", 1800);
        break;
      default:
        this.call(out, t, 0.25, 0.35, "sawtooth", [300 * k, 200 * k], 800);
    }
  }

  /** A bow twang; at a position for other archers, or right at the player when omitted. */
  bowShot(at?: { x: number; y: number; z: number }, pitch = 1) {
    if (!this.ctx) return;
    const out = at ? this.placed(at.x, at.y, at.z) : this.sfx;
    if (!out) return;
    this.tone(520 * pitch, 0.12, 0.1, "triangle", undefined, out, 260 * pitch);
    if (at) this.blockAt("cloth", "step", at.x, at.y, at.z);
    else this.block("cloth", "step");
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

  /** Water sloshing; at a position when given (buckets, fishing), otherwise around the player. */
  splash(at?: { x: number; y: number; z: number }) {
    if (at) {
      this.blockAt("sand", "break", at.x, at.y, at.z);
      this.blockAt("grass", "place", at.x, at.y, at.z);
      return;
    }
    this.block("sand", "break");
    this.block("grass", "place");
  }

  /** Lever, button and door clicks. */
  switchClick(on: boolean, x: number, y: number, z: number) {
    const out = this.placed(x, y, z);
    if (!out) return;
    this.tone(on ? 900 : 700, 0.04, 0.14, "square", undefined, out);
    this.blockAt("stone", "step", x, y, z);
  }

  /** Bobber hitting the water, or a fish taking the bait (louder). */
  bobber(bite: boolean, x: number, y: number, z: number) {
    this.blockAt("sand", bite ? "break" : "step", x, y, z);
    const out = bite ? this.placed(x, y, z) : null;
    if (out) this.tone(380, 0.12, 0.08, "sine", undefined, out, 220);
  }

  private rainNodes: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

  /** Steady hiss of rain at `level` 0..1 (0 stops it). Muffled under a roof via `muffle`. */
  setRain(level: number, muffle = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (level <= 0.01) {
      if (this.rainNodes) {
        const r = this.rainNodes;
        r.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        r.src.stop(ctx.currentTime + 1.5);
        this.rainNodes = null;
      }
      return;
    }
    if (!this.rainNodes) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 5200;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(hp);
      hp.connect(lp);
      lp.connect(gain);
      gain.connect(this.sfx);
      src.start();
      this.rainNodes = { src, gain };
    }
    this.rainNodes.gain.gain.setTargetAtTime(level * 0.16 * (1 - muffle * 0.7), ctx.currentTime, 0.4);
  }

  /** Rolling thunder; `distance` 0..1 makes it quieter and duller. */
  thunder(distance = 0.5) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.05;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(900 - distance * 600, t);
    lp.frequency.exponentialRampToValueAtTime(120, t + 3.5);
    const g = ctx.createGain();
    const peak = 0.9 * (1 - distance * 0.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.04);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.6);
    g.gain.linearRampToValueAtTime(peak * 0.5, t + 1.1);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 4.2);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + 4.4);
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

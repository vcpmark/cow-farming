/**
 * Farm sounds synthesised with the Web Audio API.
 *
 * Animal calls use a small formant synthesiser: a buzzy glottal source with a
 * pitch envelope, vibrato and jitter is shaped by three resonant band-pass
 * "formant" filters whose centre frequencies glide like a mouth changing
 * shape (m-oo, b-aa), mixed with a little breath noise. That gets much closer
 * to a real cow, sheep or horse than a plain oscillator. Everything runs
 * through a compressor so it can be loud on a phone speaker without clipping.
 */
import type { SoundKind } from '../characters';
import { Radio } from './radio';

/** A tiny valid WAV file containing 0.1 s of silence (8 kHz, 8-bit mono). */
const SILENT_WAV = (() => {
  const rate = 8000;
  const samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const w = (o: number, str: string) => {
    for (let i = 0; i < str.length; i++) bytes[o + i] = str.charCodeAt(i);
  };
  const u32 = (o: number, v: number) => {
    bytes[o] = v & 255;
    bytes[o + 1] = (v >> 8) & 255;
    bytes[o + 2] = (v >> 16) & 255;
    bytes[o + 3] = (v >> 24) & 255;
  };
  const u16 = (o: number, v: number) => {
    bytes[o] = v & 255;
    bytes[o + 1] = (v >> 8) & 255;
  };
  w(0, 'RIFF');
  u32(4, 36 + samples);
  w(8, 'WAVE');
  w(12, 'fmt ');
  u32(16, 16);
  u16(20, 1);
  u16(22, 1);
  u32(24, rate);
  u32(28, rate);
  u16(32, 1);
  u16(34, 8);
  w(36, 'data');
  u32(40, samples);
  bytes.fill(128, 44);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(bin)}`;
})();

type Env = [number, number][]; // [time 0..1 of duration, value]

interface Formant {
  f: Env;
  q: number;
  g: number;
}

interface VoiceSpec {
  /** Seconds. */
  dur: number;
  /** Fundamental pitch envelope in Hz. */
  f0: Env;
  formants: Formant[];
  /** Amplitude envelope (0..1). */
  amp: Env;
  /** Amplitude wobble, like a sheep's bleat. */
  tremolo?: { rate: number; depth: number };
  /** Pitch wobble in Hz. */
  vibrato?: { rate: number; depth: number };
  /** Breath / snort noise mix 0..1 and its centre frequency. */
  noise?: number;
  noiseFreq?: number;
  /** Slow random pitch drift in Hz, makes it organic. */
  jitter?: number;
  source?: OscillatorType;
  volume: number;
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private engine: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode; noiseGain: GainNode } | null = null;
  private silent: HTMLAudioElement | null = null;
  private jitterBuffer: AudioBuffer | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private analyser: AnalyserNode | null = null;
  radio: Radio;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('farm-muted') === '1';
    } catch {
      this.muted = false;
    }
    this.radio = new Radio();
  }

  /** Peak and RMS of the current output block (0..1), for the smoke test. */
  probe(): { peak: number; rms: number } {
    if (!this.analyser) return { peak: 0, rms: 0 };
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let peak = 0;
    let sum = 0;
    for (const v of data) {
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
    }
    return { peak, rms: Math.sqrt(sum / data.length) };
  }

  /** Current audio context state, for diagnostics. */
  get state(): string {
    return this.ctx ? this.ctx.state : 'none';
  }

  /**
   * Must be called from a user gesture (touch / click). iPhone Safari keeps a
   * new context suspended until resume() is called inside a gesture, and it
   * silences Web Audio when the ring/silent switch is on silent unless the
   * page is also playing a media element, so we loop a silent clip too.
   */
  unlock(): void {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!this.ctx) {
      const ctx = new AC();
      this.ctx = ctx;
      // Master chain: sfx + music -> compressor -> destination. The compressor
      // lets everything run hot for a phone speaker without distortion.
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(comp);
      comp.connect(ctx.destination);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      comp.connect(this.analyser);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 1;
      this.sfxBus.connect(this.master);
      this.radio.attach(ctx, this.master);
      const again = () => this.resume();
      window.addEventListener('touchend', again, { passive: true });
      window.addEventListener('click', again, { passive: true });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.resume();
      });
    }
    this.resume();
    this.startSilentLoop();
    if (!this.muted) this.radio.applyPreference();
  }

  private resume(): void {
    if (!this.ctx) return;
    if (this.ctx.state !== 'running') void this.ctx.resume().catch(() => undefined);
    try {
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.ctx.destination);
      src.start(0);
    } catch {
      /* ignore */
    }
  }

  private startSilentLoop(): void {
    if (this.silent) {
      if (this.silent.paused && !this.muted) void this.silent.play().catch(() => undefined);
      return;
    }
    try {
      const a = new Audio(SILENT_WAV);
      a.loop = true;
      a.volume = 0.01;
      a.setAttribute('playsinline', '');
      a.preload = 'auto';
      this.silent = a;
      if (!this.muted) void a.play().catch(() => undefined);
    } catch {
      this.silent = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem('farm-muted', m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
    if (m) window.speechSynthesis?.cancel();
    if (this.silent) {
      if (m) this.silent.pause();
      else void this.silent.play().catch(() => undefined);
    }
    if (!m) {
      this.resume();
      this.radio.applyPreference();
    }
  }

  // ---- building blocks -----------------------------------------------------------

  private noise(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    return src;
  }

  /** Slow, smooth random signal (about 25 Hz wobble) used as pitch jitter. */
  private jitter(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    if (!this.jitterBuffer) {
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      const step = Math.floor(ctx.sampleRate / 25);
      let a = Math.random() * 2 - 1;
      let b = Math.random() * 2 - 1;
      for (let i = 0; i < len; i++) {
        const k = (i % step) / step;
        if (i % step === 0) {
          a = b;
          b = Math.random() * 2 - 1;
        }
        d[i] = a + (b - a) * (k * k * (3 - 2 * k));
      }
      this.jitterBuffer = buf;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.jitterBuffer;
    src.loop = true;
    return src;
  }

  private env(param: AudioParam, t0: number, dur: number, env: Env, floor = 0.0001): void {
    param.setValueAtTime(Math.max(floor, env[0][1]), t0);
    for (let i = 1; i < env.length; i++) {
      const [t, v] = env[i];
      param.linearRampToValueAtTime(Math.max(floor, v), t0 + t * dur);
    }
  }

  /** The formant voice: source -> parallel band-pass formants -> amp envelope. */
  private voice(spec: VoiceSpec, distance = 1, delay = 0): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const dur = spec.dur;

    const osc = ctx.createOscillator();
    osc.type = spec.source ?? 'sawtooth';
    this.env(osc.frequency, t0, dur, spec.f0, 20);
    if (spec.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = spec.vibrato.rate;
      const lg = ctx.createGain();
      lg.gain.value = spec.vibrato.depth;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.1);
    }
    if (spec.jitter) {
      const j = this.jitter();
      const jg = ctx.createGain();
      jg.gain.value = spec.jitter;
      j.connect(jg);
      jg.connect(osc.frequency);
      j.start(t0);
      j.stop(t0 + dur + 0.1);
    }
    const srcGain = ctx.createGain();
    srcGain.gain.value = 1;
    osc.connect(srcGain);

    if (spec.noise) {
      const n = this.noise();
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = spec.noiseFreq ?? 1500;
      bp.Q.value = 0.8;
      const ng = ctx.createGain();
      ng.gain.value = spec.noise;
      n.connect(bp);
      bp.connect(ng);
      ng.connect(srcGain);
      n.start(t0);
      n.stop(t0 + dur + 0.1);
    }

    const sum = ctx.createGain();
    for (const fm of spec.formants) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = fm.q;
      this.env(bp.frequency, t0, dur, fm.f, 50);
      const g = ctx.createGain();
      g.gain.value = fm.g;
      srcGain.connect(bp);
      bp.connect(g);
      g.connect(sum);
    }

    const amp = ctx.createGain();
    this.env(amp.gain, t0, dur, spec.amp.map(([t, v]) => [t, v * spec.volume * Math.min(1, distance)]));
    amp.gain.setTargetAtTime(0.0001, t0 + dur, 0.03);
    sum.connect(amp);

    let out: AudioNode = amp;
    if (spec.tremolo) {
      const tg = ctx.createGain();
      tg.gain.value = 1 - spec.tremolo.depth / 2;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = spec.tremolo.rate;
      const lg = ctx.createGain();
      lg.gain.value = spec.tremolo.depth / 2;
      lfo.connect(lg);
      lg.connect(tg.gain);
      lfo.start(t0);
      lfo.stop(t0 + dur + 0.1);
      amp.connect(tg);
      out = tg;
    }
    out.connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.15);
  }

  private tone(type: OscillatorType, freqs: Env, dur: number, vol: number, opts: { attack?: number; filter?: number; delay?: number } = {}): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = type;
    this.env(osc.frequency, t0, dur, freqs, 20);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack ?? 0.01));
    g.gain.setValueAtTime(vol, t0 + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = osc;
    if (opts.filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = opts.filter;
      osc.connect(lp);
      node = lp;
    }
    node.connect(g);
    g.connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private burst(dur: number, vol: number, freq: number, q = 1, delay = 0): void {
    if (!this.ctx || !this.sfxBus) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const n = this.noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
    n.start(t0);
    n.stop(t0 + dur + 0.05);
  }

  // ---- the animals -----------------------------------------------------------------

  play(kind: SoundKind, distance = 1): void {
    if (!this.ctx || this.muted || distance <= 0.02) return;
    const d = Math.min(1, distance);
    switch (kind) {
      case 'moo': {
        // "Mmm-oooo": closed mouth opening into a round vowel, pitch rising then sagging.
        const spec: VoiceSpec = {
          dur: 1.5,
          f0: [
            [0, 95],
            [0.25, 135],
            [0.7, 125],
            [1, 85],
          ],
          formants: [
            { f: [[0, 260], [0.3, 380], [1, 320]], q: 9, g: 1.0 },
            { f: [[0, 900], [0.3, 750], [1, 650]], q: 10, g: 0.55 },
            { f: [[0, 2300], [0.4, 2500], [1, 2200]], q: 12, g: 0.18 },
          ],
          amp: [
            [0, 0],
            [0.12, 0.7],
            [0.35, 1],
            [0.8, 0.8],
            [1, 0],
          ],
          vibrato: { rate: 5, depth: 4 },
          jitter: 6,
          noise: 0.08,
          noiseFreq: 700,
          volume: 1.4,
        };
        this.voice(spec, d);
        // Chest resonance an octave down gives it size.
        this.voice({ ...spec, f0: spec.f0.map(([t, f]) => [t, f / 2]), volume: 0.5, formants: [{ f: [[0, 180], [1, 160]], q: 6, g: 1 }] }, d);
        break;
      }
      case 'baa': {
        const spec: VoiceSpec = {
          dur: 1.0,
          f0: [
            [0, 250],
            [0.2, 300],
            [0.8, 290],
            [1, 230],
          ],
          formants: [
            { f: [[0, 600], [0.2, 750], [1, 700]], q: 8, g: 1 },
            { f: [[0, 1500], [0.2, 1750], [1, 1600]], q: 10, g: 0.6 },
            { f: [[0, 2600], [1, 2500]], q: 12, g: 0.25 },
          ],
          amp: [
            [0, 0],
            [0.08, 1],
            [0.85, 0.8],
            [1, 0],
          ],
          tremolo: { rate: 9, depth: 0.7 },
          vibrato: { rate: 9, depth: 12 },
          jitter: 8,
          noise: 0.1,
          noiseFreq: 2000,
          volume: 1.1,
        };
        this.voice(spec, d);
        break;
      }
      case 'maa': {
        this.voice(
          {
            dur: 0.7,
            f0: [
              [0, 360],
              [0.3, 430],
              [1, 340],
            ],
            formants: [
              { f: [[0, 750], [1, 800]], q: 8, g: 1 },
              { f: [[0, 1600], [1, 1500]], q: 10, g: 0.6 },
              { f: [[0, 2700], [1, 2600]], q: 12, g: 0.25 },
            ],
            amp: [
              [0, 0],
              [0.08, 1],
              [0.8, 0.9],
              [1, 0],
            ],
            tremolo: { rate: 13, depth: 0.7 },
            vibrato: { rate: 13, depth: 18 },
            jitter: 10,
            noise: 0.12,
            noiseFreq: 2400,
            volume: 1.0,
          },
          d,
        );
        break;
      }
      case 'neigh': {
        // A whinny: high, fast-quivering start sliding down to a lower nicker, then a snort.
        this.voice(
          {
            dur: 1.3,
            f0: [
              [0, 900],
              [0.15, 1150],
              [0.5, 800],
              [0.8, 450],
              [1, 300],
            ],
            formants: [
              { f: [[0, 1000], [0.6, 800], [1, 500]], q: 7, g: 1 },
              { f: [[0, 2300], [1, 1700]], q: 9, g: 0.6 },
              { f: [[0, 3400], [1, 2800]], q: 10, g: 0.3 },
            ],
            amp: [
              [0, 0],
              [0.05, 1],
              [0.6, 0.9],
              [0.85, 0.5],
              [1, 0],
            ],
            vibrato: { rate: 22, depth: 90 },
            jitter: 30,
            noise: 0.25,
            noiseFreq: 2500,
            volume: 1.0,
          },
          d,
        );
        this.burst(0.35, 0.5 * d, 900, 0.6, 1.15); // snort
        break;
      }
      case 'woof': {
        for (const dl of [0, 0.28]) {
          this.voice(
            {
              dur: 0.16,
              f0: [
                [0, 260],
                [0.3, 180],
                [1, 120],
              ],
              formants: [
                { f: [[0, 700], [1, 500]], q: 6, g: 1 },
                { f: [[0, 1300], [1, 1000]], q: 8, g: 0.7 },
                { f: [[0, 2600], [1, 2200]], q: 8, g: 0.35 },
              ],
              amp: [
                [0, 0],
                [0.1, 1],
                [0.5, 0.7],
                [1, 0],
              ],
              noise: 0.5,
              noiseFreq: 1200,
              jitter: 15,
              volume: 1.3,
            },
            d,
            dl,
          );
        }
        break;
      }
      case 'oink': {
        // Nasal grunt with a snorty in-breath first.
        this.burst(0.18, 0.5 * d, 1800, 0.7, 0);
        this.voice(
          {
            dur: 0.4,
            f0: [
              [0, 220],
              [0.4, 160],
              [1, 130],
            ],
            formants: [
              { f: [[0, 450], [1, 350]], q: 6, g: 1 },
              { f: [[0, 1100], [1, 900]], q: 8, g: 0.7 },
              { f: [[0, 2500], [1, 2300]], q: 8, g: 0.3 },
            ],
            amp: [
              [0, 0],
              [0.15, 1],
              [0.7, 0.8],
              [1, 0],
            ],
            noise: 0.45,
            noiseFreq: 900,
            jitter: 20,
            tremolo: { rate: 28, depth: 0.5 },
            volume: 1.2,
          },
          d,
          0.12,
        );
        break;
      }
      case 'cluck': {
        // "buk-buk-buk-b'gawk"
        const notes = [0, 0.16, 0.32, 0.5];
        notes.forEach((dl, i) => {
          const last = i === notes.length - 1;
          this.voice(
            {
              dur: last ? 0.28 : 0.09,
              f0: last
                ? [
                    [0, 600],
                    [0.3, 950],
                    [1, 500],
                  ]
                : [
                    [0, 700],
                    [1, 520],
                  ],
              formants: [
                { f: [[0, 1300], [1, 1000]], q: 8, g: 1 },
                { f: [[0, 2800], [1, 2400]], q: 9, g: 0.5 },
              ],
              amp: [
                [0, 0],
                [0.15, 1],
                [1, 0],
              ],
              noise: 0.3,
              noiseFreq: 2500,
              jitter: 25,
              volume: 0.9,
            },
            d,
            dl,
          );
        });
        break;
      }
      case 'crow': {
        // Cock-a-doodle-doo: four notes, the third held high, the last falling.
        const seq: [number, number, number, number][] = [
          [0, 0.18, 650, 700],
          [0.2, 0.18, 750, 800],
          [0.4, 0.45, 950, 1000],
          [0.9, 0.5, 900, 600],
        ];
        for (const [dl, dur, fa, fb] of seq) {
          this.voice(
            {
              dur,
              f0: [
                [0, fa],
                [0.5, fb],
                [1, fb * 0.9],
              ],
              formants: [
                { f: [[0, 1400], [1, 1200]], q: 7, g: 1 },
                { f: [[0, 2600], [1, 2400]], q: 9, g: 0.5 },
              ],
              amp: [
                [0, 0],
                [0.1, 1],
                [0.8, 0.9],
                [1, 0],
              ],
              vibrato: { rate: 8, depth: 25 },
              noise: 0.2,
              noiseFreq: 2200,
              jitter: 15,
              volume: 1.0,
            },
            d,
            dl,
          );
        }
        break;
      }
      case 'quack': {
        for (const dl of [0, 0.22, 0.44]) {
          this.voice(
            {
              dur: 0.2,
              f0: [
                [0, 480],
                [0.4, 380],
                [1, 300],
              ],
              formants: [
                { f: [[0, 800], [1, 650]], q: 5, g: 1 },
                { f: [[0, 1800], [1, 1500]], q: 7, g: 0.7 },
                { f: [[0, 2900], [1, 2600]], q: 8, g: 0.4 },
              ],
              amp: [
                [0, 0],
                [0.1, 1],
                [0.6, 0.8],
                [1, 0],
              ],
              noise: 0.4,
              noiseFreq: 1800,
              jitter: 20,
              volume: 1.1,
            },
            d,
            dl,
          );
        }
        break;
      }
      case 'hello':
        // Farmers actually speak (see Game); this is a friendly two-note whistle behind it.
        this.tone('sine', [[0, 660], [1, 660]], 0.14, 0.35 * d);
        this.tone('sine', [[0, 880], [1, 880]], 0.22, 0.35 * d, { delay: 0.15 });
        break;
      case 'horn':
        for (const dl of [0, 0.32]) {
          this.tone('square', [[0, 330], [1, 330]], dl ? 0.4 : 0.25, 0.5 * d, { filter: 1500, delay: dl });
          this.tone('square', [[0, 415], [1, 415]], dl ? 0.4 : 0.25, 0.4 * d, { filter: 1500, delay: dl });
          this.tone('sawtooth', [[0, 165], [1, 165]], dl ? 0.4 : 0.25, 0.3 * d, { filter: 900, delay: dl });
        }
        break;
    }
  }

  sparkle(): void {
    if (!this.ctx || this.muted) return;
    [0, 1, 2, 3, 4].forEach((i) => this.tone('sine', [[0, 880 + i * 220], [1, 880 + i * 220]], 0.25, 0.3, { delay: i * 0.06 }));
  }

  ding(): void {
    if (!this.ctx || this.muted) return;
    this.tone('sine', [[0, 1320], [1, 1320]], 0.3, 0.4);
    this.tone('sine', [[0, 1760], [1, 1760]], 0.4, 0.25);
  }

  /** Show ring fanfare when the ribbons are handed out. */
  fanfare(): void {
    if (!this.ctx || this.muted) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      this.tone('square', [[0, f], [1, f]], i === 3 ? 0.7 : 0.22, 0.35, { filter: 2500, delay: i * 0.18 });
      this.tone('sawtooth', [[0, f / 2], [1, f / 2]], i === 3 ? 0.7 : 0.22, 0.2, { filter: 1200, delay: i * 0.18 });
    });
    this.burst(1.4, 0.35, 3000, 0.5, 0.7); // applause-ish
  }

  tick(good: boolean): void {
    if (!this.ctx || this.muted) return;
    this.tone('sine', [[0, good ? 1200 : 300], [1, good ? 1500 : 200]], 0.12, 0.4);
  }

  brush(): void {
    if (!this.ctx || this.muted) return;
    this.burst(0.12, 0.2, 1800, 0.8);
  }

  splash(): void {
    if (!this.ctx || this.muted) return;
    this.burst(0.4, 0.6, 900, 0.7);
    this.tone('sine', [[0, 300], [1, 120]], 0.25, 0.3);
  }

  munch(): void {
    if (!this.ctx || this.muted) return;
    this.burst(0.08, 0.3, 2500, 1);
    this.burst(0.08, 0.25, 2000, 1, 0.16);
  }

  /** Continuous engine while a tractor is driven; call each frame. */
  setEngine(on: boolean, speed: number): void {
    if (!this.ctx || !this.sfxBus) return;
    if (on && !this.engine) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const gain = ctx.createGain();
      gain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 12;
      const lg = ctx.createGain();
      lg.gain.value = 14;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      osc.connect(lp);
      lp.connect(gain);
      // Diesel rattle: noise chopped by the same LFO.
      const n = this.noise();
      const nbp = ctx.createBiquadFilter();
      nbp.type = 'bandpass';
      nbp.frequency.value = 700;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0;
      n.connect(nbp);
      nbp.connect(noiseGain);
      noiseGain.connect(gain);
      n.start();
      gain.connect(this.sfxBus);
      osc.start();
      lfo.start();
      this.engine = { osc, gain, lfo, noiseGain };
    }
    if (this.engine) {
      const target = on ? 0.18 + speed * 0.2 : 0;
      this.engine.gain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.1);
      this.engine.osc.frequency.setTargetAtTime(45 + speed * 40, this.ctx.currentTime, 0.1);
      this.engine.lfo.frequency.setTargetAtTime(10 + speed * 14, this.ctx.currentTime, 0.1);
      this.engine.noiseGain.gain.setTargetAtTime(0.25 + speed * 0.3, this.ctx.currentTime, 0.1);
    }
  }
}

// ---- speech -----------------------------------------------------------------------

let chosenVoice: SpeechSynthesisVoice | null = null;
let voicesReady = false;

/** Prefer the natural sounding system voices (iPhone: Samantha / Ava / Allison; Android: Google US English). */
function pickVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const pool = english.length ? english : voices;
  const score = (v: SpeechSynthesisVoice): number => {
    const n = v.name.toLowerCase();
    let s = 0;
    if (/premium|enhanced|natural|neural/.test(n)) s += 50;
    if (/samantha|ava|allison|zoe|nicky|karen|moira|daniel|aria|jenny|libby|google us english|google uk english female/.test(n)) s += 30;
    if (v.lang.toLowerCase() === 'en-us') s += 10;
    if (v.localService) s += 5;
    if (/compact|eloquence|fred|zarvox|whisper|bad news|bells|cellos|trinoids|bubbles|boing|organ|jester|junior|ralph|albert|hysterical|wobble|good news|bahh|pipe organ|deranged|superstar|rocko|shelley|grandma|grandpa|reed|sandy|flo|kathy/.test(n)) s -= 40;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
}

if ('speechSynthesis' in window) {
  const refresh = () => {
    chosenVoice = pickVoice();
    voicesReady = chosenVoice !== null;
  };
  refresh();
  window.speechSynthesis.addEventListener?.('voiceschanged', refresh);
}

/** True while the narrator is talking (used to duck the radio). */
export function isSpeaking(): boolean {
  return 'speechSynthesis' in window && window.speechSynthesis.speaking;
}

/** Reads text aloud for players who can't read yet. `interrupt` cuts off the current line. */
export function speak(text: string, muted: boolean, interrupt = true): void {
  if (muted || !('speechSynthesis' in window)) return;
  try {
    if (!voicesReady) chosenVoice = pickVoice();
    if (interrupt) window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (chosenVoice) u.voice = chosenVoice;
    u.rate = 0.92;
    u.pitch = 1.05;
    u.volume = 1;
    u.lang = chosenVoice?.lang ?? 'en-US';
    window.speechSynthesis.speak(u);
  } catch {
    /* speech is optional */
  }
}

/**
 * Synthesised farm sounds with the Web Audio API. No sound files needed, so
 * the app stays tiny. Every sound is a small envelope-shaped oscillator or
 * noise burst tuned to feel like the real animal.
 */
import type { SoundKind } from '../characters';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: { osc: OscillatorNode; gain: GainNode; lfo: OscillatorNode } | null = null;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('farm-muted') === '1';
    } catch {
      this.muted = false;
    }
  }

  /** Must be called from a user gesture on iOS. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem('farm-muted', m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
    if (m) window.speechSynthesis?.cancel();
  }

  private tone(
    type: OscillatorType,
    freqs: [number, number][],
    duration: number,
    volume: number,
    opts: { attack?: number; vibrato?: number; vibratoRate?: number; filter?: number; distance?: number } = {},
  ): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    const gain = ctx.createGain();
    const vol = volume * (opts.distance ?? 1);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + (opts.attack ?? 0.03));
    gain.gain.setValueAtTime(vol, t0 + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.frequency.setValueAtTime(freqs[0][1], t0);
    for (const [tt, f] of freqs) osc.frequency.linearRampToValueAtTime(f, t0 + tt * duration);
    let node: AudioNode = osc;
    if (opts.filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = opts.filter;
      lp.Q.value = 3;
      osc.connect(lp);
      node = lp;
    }
    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = opts.vibratoRate ?? 6;
      const lg = ctx.createGain();
      lg.gain.value = opts.vibrato;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + duration);
    }
    node.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  private noise(duration: number, volume: number, filter: number, distance = 1): void {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = filter;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(volume * distance, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    src.start();
  }

  play(kind: SoundKind, distance = 1): void {
    if (!this.ctx || this.muted || distance <= 0.02) return;
    const d = Math.min(1, distance);
    switch (kind) {
      case 'moo':
        this.tone('sawtooth', [[0, 140], [0.3, 175], [0.8, 150], [1, 120]], 1.1, 0.35, { attack: 0.12, vibrato: 4, vibratoRate: 5, filter: 700, distance: d });
        this.tone('triangle', [[0, 70], [0.3, 88], [1, 60]], 1.1, 0.25, { attack: 0.15, filter: 400, distance: d });
        break;
      case 'neigh':
        this.tone('sawtooth', [[0, 900], [0.15, 1300], [0.5, 1100], [1, 600]], 0.9, 0.22, { attack: 0.02, vibrato: 60, vibratoRate: 18, filter: 2200, distance: d });
        this.tone('square', [[0, 450], [0.5, 550], [1, 300]], 0.9, 0.08, { attack: 0.05, vibrato: 30, vibratoRate: 18, filter: 1200, distance: d });
        break;
      case 'woof':
        this.tone('sawtooth', [[0, 380], [0.2, 300], [1, 180]], 0.18, 0.4, { attack: 0.01, filter: 900, distance: d });
        this.noise(0.15, 0.25, 700, d);
        setTimeout(() => {
          this.tone('sawtooth', [[0, 400], [0.2, 310], [1, 190]], 0.18, 0.4, { attack: 0.01, filter: 900, distance: d });
          this.noise(0.15, 0.25, 700, d);
        }, 220);
        break;
      case 'oink':
        this.tone('square', [[0, 260], [0.4, 180], [1, 220]], 0.28, 0.25, { attack: 0.02, vibrato: 40, vibratoRate: 25, filter: 800, distance: d });
        this.noise(0.25, 0.3, 1600, d);
        break;
      case 'baa':
        this.tone('sawtooth', [[0, 330], [0.5, 360], [1, 300]], 0.8, 0.28, { attack: 0.05, vibrato: 25, vibratoRate: 9, filter: 1400, distance: d });
        break;
      case 'maa':
        this.tone('sawtooth', [[0, 420], [0.5, 470], [1, 380]], 0.6, 0.26, { attack: 0.04, vibrato: 35, vibratoRate: 11, filter: 1800, distance: d });
        break;
      case 'cluck':
        for (let i = 0; i < 4; i++) {
          setTimeout(() => this.tone('square', [[0, 700 + i * 60], [0.5, 900], [1, 500]], 0.12, 0.18, { attack: 0.01, filter: 2500, distance: d }), i * 130);
        }
        break;
      case 'quack':
        for (let i = 0; i < 2; i++) {
          setTimeout(() => {
            this.tone('sawtooth', [[0, 520], [0.3, 400], [1, 300]], 0.22, 0.3, { attack: 0.01, filter: 1500, distance: d });
            this.noise(0.15, 0.15, 1200, d);
          }, i * 260);
        }
        break;
      case 'hello':
        this.tone('sine', [[0, 520], [1, 520]], 0.15, 0.25, { distance: d });
        setTimeout(() => this.tone('sine', [[0, 660], [1, 660]], 0.22, 0.25, { distance: d }), 160);
        break;
      case 'horn':
        this.tone('square', [[0, 330], [1, 330]], 0.25, 0.25, { attack: 0.01, filter: 1200, distance: d });
        this.tone('square', [[0, 415], [1, 415]], 0.25, 0.2, { attack: 0.01, filter: 1200, distance: d });
        setTimeout(() => {
          this.tone('square', [[0, 330], [1, 330]], 0.35, 0.25, { attack: 0.01, filter: 1200, distance: d });
          this.tone('square', [[0, 415], [1, 415]], 0.35, 0.2, { attack: 0.01, filter: 1200, distance: d });
        }, 300);
        break;
    }
  }

  sparkle(): void {
    if (!this.ctx || this.muted) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.tone('sine', [[0, 880 + i * 220], [1, 880 + i * 220]], 0.25, 0.15), i * 60);
    }
  }

  ding(): void {
    if (!this.ctx || this.muted) return;
    this.tone('sine', [[0, 1320], [1, 1320]], 0.3, 0.2);
    this.tone('sine', [[0, 1760], [1, 1760]], 0.4, 0.12);
  }

  /** Show ring fanfare when the ribbons are handed out. */
  fanfare(): void {
    if (!this.ctx || this.muted) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => setTimeout(() => this.tone('square', [[0, f], [1, f]], i === 3 ? 0.7 : 0.22, 0.18, { attack: 0.01, filter: 2500 }), i * 180));
    setTimeout(() => this.noise(1.2, 0.12, 3000), 700); // applause-ish
  }

  /** A short tick for timing games. */
  tick(good: boolean): void {
    if (!this.ctx || this.muted) return;
    this.tone('sine', [[0, good ? 1200 : 300], [1, good ? 1500 : 200]], 0.12, 0.2);
  }

  brush(): void {
    if (!this.ctx || this.muted) return;
    this.noise(0.12, 0.08, 1800);
  }

  splash(): void {
    if (!this.ctx || this.muted) return;
    this.noise(0.4, 0.3, 900);
    this.tone('sine', [[0, 300], [1, 120]], 0.25, 0.15);
  }

  munch(): void {
    if (!this.ctx || this.muted) return;
    this.noise(0.08, 0.12, 2500);
  }

  /** Continuous engine while a tractor is driven; call each frame. */
  setEngine(on: boolean, speed: number): void {
    if (!this.ctx || !this.master) return;
    if (on && !this.engine) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 220;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 12;
      const lg = this.ctx.createGain();
      lg.gain.value = 12;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      osc.connect(lp);
      lp.connect(gain);
      gain.connect(this.master);
      osc.start();
      lfo.start();
      this.engine = { osc, gain, lfo };
    }
    if (this.engine) {
      const target = on ? 0.08 + speed * 0.1 : 0;
      this.engine.gain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.1);
      this.engine.osc.frequency.setTargetAtTime(45 + speed * 40, this.ctx.currentTime, 0.1);
      this.engine.lfo.frequency.setTargetAtTime(10 + speed * 14, this.ctx.currentTime, 0.1);
    }
  }
}

/** Reads the character's introduction aloud for players who can't read yet. */
export function speak(text: string, muted: boolean): void {
  if (muted || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.05;
    u.lang = 'en-US';
    window.speechSynthesis.speak(u);
  } catch {
    /* speech is optional */
  }
}

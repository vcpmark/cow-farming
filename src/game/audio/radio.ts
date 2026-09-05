/**
 * Farm radio: a generated country tune (guitar boom-chick, walking bass,
 * brushed snare and a fiddle lead) played with Web Audio. Nothing is recorded,
 * so it never repeats exactly and costs no download. Ducks under the narrator.
 */
import { isSpeaking } from './sfx';

const BPM = 118;
const BEAT = 60 / BPM;
const SWING = 0.1; // off-beat eighths land late, like a shuffle

type ChordName = 'G' | 'C' | 'D' | 'Em';
const PROGRESSION: ChordName[] = ['G', 'G', 'C', 'G', 'D', 'D', 'G', 'G', 'G', 'Em', 'C', 'G', 'D', 'D', 'G', 'G'];
// MIDI note numbers.
const CHORDS: Record<ChordName, { root: number; fifth: number; strum: number[] }> = {
  G: { root: 43, fifth: 50, strum: [55, 59, 62, 67] },
  C: { root: 48, fifth: 55, strum: [55, 60, 64, 67] },
  D: { root: 50, fifth: 57, strum: [57, 62, 66, 69] },
  Em: { root: 40, fifth: 47, strum: [55, 59, 64, 67] },
};
// Fiddle licks per chord: [midi, beats] pairs, one bar each. 0 = rest.
const LICKS: Record<ChordName, [number, number][][]> = {
  G: [
    [[67, 0.5], [69, 0.5], [71, 0.5], [74, 0.5], [71, 0.5], [69, 0.5], [67, 1]],
    [[62, 0.5], [67, 0.5], [71, 0.5], [67, 0.5], [74, 0.5], [71, 0.5], [67, 1]],
    [[79, 0.5], [78, 0.5], [76, 0.5], [74, 0.5], [71, 0.5], [69, 0.5], [67, 1]],
    [[67, 1], [0, 0.5], [71, 0.5], [74, 1], [0, 1]],
  ],
  C: [
    [[64, 0.5], [67, 0.5], [72, 0.5], [76, 0.5], [72, 0.5], [67, 0.5], [64, 1]],
    [[72, 0.5], [71, 0.5], [72, 0.5], [74, 0.5], [76, 1], [72, 1]],
  ],
  D: [
    [[69, 0.5], [66, 0.5], [69, 0.5], [74, 0.5], [69, 0.5], [66, 0.5], [62, 1]],
    [[69, 0.5], [71, 0.5], [72, 0.5], [71, 0.5], [69, 0.5], [66, 0.5], [69, 1]],
  ],
  Em: [[[64, 0.5], [67, 0.5], [71, 0.5], [76, 0.5], [71, 0.5], [67, 0.5], [64, 1]]],
};

const midiHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

export class Radio {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private timer: number | null = null;
  private nextBar = 0;
  private barIndex = 0;
  private lickCounter = 0;
  private noiseBuffer: AudioBuffer | null = null;
  private lastFiddle = 0;
  playing = false;
  /** Player preference, persisted. */
  wanted = true;
  private level = 0.55;

  constructor() {
    try {
      const v = localStorage.getItem('farm-radio');
      this.wanted = v === null ? true : v === '1';
    } catch {
      this.wanted = true;
    }
  }

  attach(ctx: AudioContext, master: GainNode): void {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    // A touch of room so it sounds like it is coming from a radio in the barn.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    this.bus.connect(lp);
    lp.connect(master);
  }

  /** Start or stop according to the saved preference (after audio is unlocked). */
  applyPreference(): void {
    if (this.wanted) this.start();
    else this.stop();
  }

  toggle(): boolean {
    this.wanted = !this.wanted;
    try {
      localStorage.setItem('farm-radio', this.wanted ? '1' : '0');
    } catch {
      /* ignore */
    }
    this.applyPreference();
    return this.wanted;
  }

  start(): void {
    if (!this.ctx || !this.bus || this.playing) return;
    this.playing = true;
    this.nextBar = this.ctx.currentTime + 0.1;
    this.bus.gain.cancelScheduledValues(this.ctx.currentTime);
    this.bus.gain.setTargetAtTime(this.level, this.ctx.currentTime, 0.4);
    this.timer = window.setInterval(() => this.tick(), 60);
  }

  stop(): void {
    if (!this.playing) return;
    this.playing = false;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.ctx && this.bus) {
      this.bus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  /** Call every frame: ducks under speech and keeps the scheduler fed. */
  update(): void {
    if (!this.ctx || !this.bus || !this.playing) return;
    const target = isSpeaking() ? this.level * 0.25 : this.level;
    this.bus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
  }

  private tick(): void {
    if (!this.ctx) return;
    // Schedule whole bars a little ahead of time.
    while (this.nextBar < this.ctx.currentTime + 0.5) {
      this.scheduleBar(this.nextBar, this.barIndex);
      this.nextBar += BEAT * 4;
      this.barIndex++;
    }
  }

  private scheduleBar(t: number, bar: number): void {
    const chord = PROGRESSION[bar % PROGRESSION.length];
    const next = PROGRESSION[(bar + 1) % PROGRESSION.length];
    const c = CHORDS[chord];
    const swing = (beat: number) => t + beat * BEAT + (beat % 1 !== 0 ? SWING * BEAT : 0);

    // Rhythm guitar: boom (bass note) - chick (strum), with a walk-up before changes.
    this.pluck(swing(0), c.root + 12, 0.7, 0.5);
    this.strum(swing(1), c.strum, 0.45);
    this.strum(swing(1.5), c.strum, 0.2);
    this.pluck(swing(2), c.fifth + 12, 0.6, 0.5);
    this.strum(swing(3), c.strum, 0.45);
    this.strum(swing(3.5), c.strum, 0.2);
    // Bass.
    this.bass(swing(0), c.root);
    if (next !== chord) {
      const target = CHORDS[next].root;
      const step = target > c.root ? 1 : -1;
      this.bass(swing(2), c.fifth - 12 + (step > 0 ? 0 : 0));
      this.bass(swing(3), target - step * 2);
      this.bass(swing(3.5), target - step);
    } else {
      this.bass(swing(2), c.fifth - 12);
    }
    // Drums: light kick on 1 and 3, brushed snare on 2 and 4, soft eighths.
    this.kick(swing(0));
    this.kick(swing(2));
    this.snare(swing(1));
    this.snare(swing(3));
    for (let e = 0.5; e < 4; e += 1) this.hat(swing(e));

    // Fiddle plays for 24 bars, rests for 8 so the tune breathes.
    if (bar % 32 < 24) {
      const licks = LICKS[chord];
      const lick = licks[this.lickCounter++ % licks.length];
      let pos = 0;
      for (const [midi, beats] of lick) {
        if (midi > 0) this.fiddle(swing(pos), midi, beats * BEAT * 0.95, 0.4);
        pos += beats;
      }
    }
  }

  private noise(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) {
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;
    }
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuffer;
    return s;
  }

  private pluck(t: number, midi: number, vel: number, dur: number): void {
    const ctx = this.ctx!;
    const f = midiHz(midi);
    const o1 = ctx.createOscillator();
    o1.type = 'triangle';
    o1.frequency.value = f;
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = f;
    o2.detune.value = 5;
    const o2g = ctx.createGain();
    o2g.gain.value = 0.35;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + 0.25);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.connect(lp);
    o2.connect(o2g);
    o2g.connect(lp);
    lp.connect(g);
    g.connect(this.bus!);
    o1.start(t);
    o2.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
  }

  private strum(t: number, notes: number[], vel: number): void {
    notes.forEach((n, i) => this.pluck(t + i * 0.012, n, vel * (0.8 + Math.random() * 0.2), 0.45));
  }

  private bass(t: number, midi: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midiHz(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(lp);
    lp.connect(g);
    g.connect(this.bus!);
    o.start(t);
    o.stop(t + 0.5);
  }

  private fiddle(t: number, midi: number, dur: number, vel: number): void {
    const ctx = this.ctx!;
    const f = midiHz(midi);
    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.detune.value = -7;
    // A little slide from the previous note, like a bow crossing strings.
    const from = this.lastFiddle && Math.abs(this.lastFiddle - f) < f * 0.5 ? this.lastFiddle : f;
    for (const o of [o1, o2]) {
      o.frequency.setValueAtTime(from, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    }
    this.lastFiddle = f;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    vg.gain.linearRampToValueAtTime(f * 0.012, t + 0.15);
    vib.connect(vg);
    vg.connect(o1.frequency);
    vg.connect(o2.frequency);
    const bp = ctx.createBiquadFilter();
    bp.type = 'lowpass';
    bp.frequency.value = 2600;
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.05);
    g.gain.setValueAtTime(vel, t + Math.max(0.06, dur - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o1.connect(bp);
    o2.connect(bp);
    bp.connect(g);
    g.connect(this.bus!);
    o1.start(t);
    o2.start(t);
    vib.start(t);
    o1.stop(t + dur + 0.05);
    o2.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  private kick(t: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g);
    g.connect(this.bus!);
    o.start(t);
    o.stop(t + 0.2);
  }

  private snare(t: number): void {
    const ctx = this.ctx!;
    const n = this.noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2800;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    n.connect(bp);
    bp.connect(g);
    g.connect(this.bus!);
    n.start(t);
    n.stop(t + 0.15);
  }

  private hat(t: number): void {
    const ctx = this.ctx!;
    const n = this.noise();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    n.connect(hp);
    hp.connect(g);
    g.connect(this.bus!);
    n.start(t);
    n.stop(t + 0.06);
  }
}

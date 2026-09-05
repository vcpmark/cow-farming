/**
 * The Cow Show mini-game.
 *
 * Modelled on a real dairy show: you groom your cow in the ring, lead her
 * around on the halter following the judge's line, set her up square when the
 * judge looks, and then the judge walks the line and hands out the ribbons.
 * Ribbons are hung on the cow's stall banner in the show barn.
 */
import type { FarmerSpec } from './breeds/otherBreeds';
import type { Entity } from './entity';
import type { Effects } from './effects';
import type { Sfx } from './audio/sfx';
import { clamp, lerp, mixColor, roundRectPath } from './util';
import { RING, STALLS, drawRosette } from './world';

export type ShowPhase = 'idle' | 'intro' | 'groom' | 'walk' | 'pose' | 'judging' | 'results';
export type Ribbon = 'champion' | 'blue' | 'red' | 'yellow' | 'white';

export const RIBBON_COLORS: Record<Ribbon, string> = {
  champion: '#7e57c2',
  blue: '#1e88e5',
  red: '#e53935',
  yellow: '#fdd835',
  white: '#f5f5f5',
};

export const RIBBON_NAMES: Record<Ribbon, string> = {
  champion: 'Grand Champion',
  blue: 'First place',
  red: 'Second place',
  yellow: 'Third place',
  white: 'Fourth place',
};

export const JUDGE: FarmerSpec = {
  id: 'judge',
  name: 'Judge Ruth',
  fact: 'Judge Ruth has judged cow shows for thirty years.',
  skin: '#e8b48d',
  hair: '#bdbdbd',
  hat: 'none',
  shirt: '#ffffff',
  overalls: '#263238',
  boots: '#3e2723',
  size: 1,
};

const GROOM_TIME = 10;
const WALK_TIME = 15;
const POSE_ROUNDS = 2;

/** Combine the three phase scores (0..1 each) into show points 0..100. */
export function totalScore(groom: number, walk: number, pose: number): number {
  const g = clamp(groom, 0, 1);
  const w = clamp(walk, 0, 1);
  const p = clamp(pose, 0, 1);
  return Math.round((0.35 * g + 0.35 * w + 0.3 * p) * 100);
}

/** Ribbon for a placing. Only a first place with a great score earns Grand Champion. */
export function ribbonFor(rank: number, points: number): Ribbon {
  if (rank === 1) return points >= 80 ? 'champion' : 'blue';
  if (rank === 2) return 'red';
  if (rank === 3) return 'yellow';
  return 'white';
}

/** 1-based rank of each score (ties broken by order). */
export function rankScores(scores: number[]): number[] {
  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s || a.i - b.i);
  const ranks = new Array<number>(scores.length);
  order.forEach((o, r) => (ranks[o.i] = r + 1));
  return ranks;
}

/** Point on the lap the judge wants the cows to walk (an oval inside the ring). */
export function lapPoint(u: number): { x: number; y: number } {
  const cx = (RING.x0 + RING.x1) / 2;
  const cy = (RING.y0 + RING.y1) / 2 + 4;
  const rx = (RING.x1 - RING.x0) / 2 - 56;
  const ry = (RING.y1 - RING.y0) / 2 - 16;
  const a = u * Math.PI * 2;
  return { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
}

export interface ShowResult {
  entity: Entity;
  points: number;
  rank: number;
  ribbon: Ribbon;
}

export interface ShowHooks {
  effects: Effects;
  sfx: Sfx;
  speak: (text: string) => void;
  award: (entityId: string, ribbon: Ribbon) => void;
}

export class CowShow {
  phase: ShowPhase = 'idle';
  timer = 0;
  cooldown = 0;
  player: Entity | null = null;
  competitors: Entity[] = [];
  judge = { x: 0, y: 0, facing: -1 as 1 | -1, moving: 0, walk: 0, targetX: 0, targetY: 0 };
  groomMeter = 0;
  walkScore = 0;
  poseScores: number[] = [];
  poseRound = 0;
  needle = 0;
  poseFeedback = '';
  poseFeedbackLife = 0;
  results: ShowResult[] = [];
  message = '';
  private lastPointer = new Map<number, { x: number; y: number }>();
  private brushCooldown = 0;
  private judgeSaid = 0;
  private hooks: ShowHooks;

  constructor(hooks: ShowHooks) {
    this.hooks = hooks;
    const c = this.ringCenter();
    this.judge.x = c.x;
    this.judge.y = RING.y0 + 14;
    this.judge.targetX = this.judge.x;
    this.judge.targetY = this.judge.y;
  }

  get active(): boolean {
    return this.phase !== 'idle';
  }

  /** Player movement is free only while leading the cow around the ring. */
  get playerMayMove(): boolean {
    return this.phase === 'walk';
  }

  ringCenter(): { x: number; y: number } {
    return { x: (RING.x0 + RING.x1) / 2, y: (RING.y0 + RING.y1) / 2 + 14 };
  }

  start(player: Entity, cows: Entity[]): void {
    this.player = player;
    this.phase = 'intro';
    this.timer = 0;
    this.groomMeter = 0;
    this.walkScore = 0;
    this.poseScores = [];
    this.poseRound = 0;
    this.results = [];
    this.lastPointer.clear();
    // Three other cows join the class, different breeds where possible.
    const others = cows.filter((c) => c !== player);
    for (let i = others.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [others[i], others[j]] = [others[j], others[i]];
    }
    this.competitors = others.slice(0, 3);
    const c = this.ringCenter();
    this.competitors.forEach((e, i) => {
      e.scripted = true;
      e.controlled = false;
      e.x = RING.x0 - 30 - i * 60;
      e.y = RING.y0 + 26;
      e.target = { x: c.x - 140 + i * 130, y: RING.y0 + 30 };
      e.facing = 1;
    });
    player.target = { x: c.x, y: c.y + 10 };
    this.judge.targetX = c.x;
    this.judge.targetY = RING.y0 + 14;
    this.message = 'Welcome to the Cow Show!';
    this.hooks.effects.say('Welcome!', this.judge.x, this.judge.y - 96, '#fff9c4');
    this.hooks.speak(`Welcome to the cow show, ${player.def.name}! First, brush her coat until it shines.`);
  }

  private setPhase(p: ShowPhase): void {
    this.phase = p;
    this.timer = 0;
    const c = this.ringCenter();
    switch (p) {
      case 'groom':
        this.message = `Brush ${this.player?.def.name}! Swipe over her coat.`;
        break;
      case 'walk':
        this.message = 'Lead her around the ring. Stay close to the star!';
        this.hooks.speak('Now lead her around the ring and stay close to the star.');
        break;
      case 'pose':
        this.message = 'Set her up! Tap when the needle is in the green.';
        this.hooks.speak('Set her up nicely. Tap when the needle is in the green.');
        this.needle = 0;
        this.poseRound = 0;
        if (this.player) this.player.target = { x: c.x, y: c.y + 10 };
        this.competitors.forEach((e, i) => (e.target = { x: c.x - 140 + i * 130, y: RING.y0 + 30 }));
        break;
      case 'judging':
        this.message = 'The judge is looking...';
        this.judgeSaid = 0;
        this.judge.targetX = c.x - 170;
        this.judge.targetY = RING.y0 + 60;
        break;
      case 'results':
        this.finish();
        break;
    }
  }

  private finish(): void {
    const p = this.player!;
    const poseAvg = this.poseScores.length ? this.poseScores.reduce((a, b) => a + b, 0) / this.poseScores.length : 0;
    const mine = totalScore(this.groomMeter, this.walkScore, poseAvg);
    const entries = [p, ...this.competitors];
    const points = entries.map((_, i) => (i === 0 ? mine : 45 + Math.floor(Math.random() * 40)));
    const ranks = rankScores(points);
    this.results = entries
      .map((entity, i) => ({ entity, points: points[i], rank: ranks[i], ribbon: ribbonFor(ranks[i], points[i]) }))
      .sort((a, b) => a.rank - b.rank);
    for (const r of this.results) this.hooks.award(r.entity.def.id, r.ribbon);
    const mineResult = this.results.find((r) => r.entity === p)!;
    this.message = `${p.def.name} wins ${RIBBON_NAMES[mineResult.ribbon]}!`;
    this.hooks.sfx.fanfare();
    this.hooks.effects.spawn('confetti', p.x, p.y - 60, 70);
    this.hooks.effects.say(mineResult.rank === 1 ? 'Hooray!' : 'Well done!', p.x, p.y - p.def.hit.h * p.scale - 6, '#fff9c4');
    this.hooks.speak(
      mineResult.ribbon === 'champion'
        ? `${p.def.name} is the Grand Champion! What a beautiful cow!`
        : `${p.def.name} takes ${RIBBON_NAMES[mineResult.ribbon].toLowerCase()}. Well done!`,
    );
    this.judge.targetX = this.ringCenter().x;
    this.judge.targetY = RING.y0 + 14;
  }

  /** Called on every new touch while the show is running. */
  press(): void {
    if (this.phase === 'pose') this.tapPose();
    else if (this.phase === 'results' && this.timer > 1.2) this.end();
  }

  private tapPose(): void {
    if (this.poseFeedbackLife > 0 || this.poseRound >= POSE_ROUNDS) return;
    const acc = 1 - Math.abs(this.needle);
    this.poseScores.push(acc);
    this.poseFeedback = acc > 0.85 ? 'Perfect!' : acc > 0.6 ? 'Nice!' : 'Almost!';
    this.poseFeedbackLife = 0.9;
    this.hooks.sfx.tick(acc > 0.6);
    const p = this.player!;
    p.triggerAction();
    this.hooks.effects.say(this.poseFeedback, p.x, p.y - p.def.hit.h * p.scale - 6, acc > 0.6 ? '#c8e6c9' : '#ffe0b2');
    if (acc > 0.6) this.hooks.effects.spawn('sparkle', p.x, p.y - 50, 8);
    this.poseRound++;
  }

  end(): void {
    for (const e of this.competitors) {
      e.scripted = false;
      e.target = null;
      e.aiTimer = 0.5;
    }
    this.competitors = [];
    if (this.player) this.player.target = null;
    this.phase = 'idle';
    this.cooldown = 4;
    this.judge.targetX = this.ringCenter().x;
    this.judge.targetY = RING.y0 + 14;
  }

  /**
   * @param pointers current touches in screen space (logical units)
   * @param toScreen converts a world point to screen space
   */
  update(
    dt: number,
    pointers: Iterable<{ id: number; x: number; y: number }>,
    toScreen: (wx: number, wy: number) => { x: number; y: number },
  ): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.updateJudge(dt);
    if (!this.active || !this.player) return;
    this.timer += dt;
    const p = this.player;
    this.poseFeedbackLife = Math.max(0, this.poseFeedbackLife - dt);

    switch (this.phase) {
      case 'intro':
        if (this.timer > 2.6) this.setPhase('groom');
        break;
      case 'groom': {
        this.brushCooldown -= dt;
        const s = p.scale;
        const c = toScreen(p.x, p.y);
        const seen = new Set<number>();
        for (const ptr of pointers) {
          seen.add(ptr.id);
          const last = this.lastPointer.get(ptr.id);
          if (last) {
            const d = Math.hypot(ptr.x - last.x, ptr.y - last.y);
            const over = Math.abs(ptr.x - c.x) < p.def.hit.w * s + 10 && ptr.y > c.y - p.def.hit.h * s - 10 && ptr.y < c.y + 10;
            if (over && d > 0) {
              this.groomMeter = clamp(this.groomMeter + d * 0.0035, 0, 1);
              if (this.brushCooldown <= 0) {
                this.brushCooldown = 0.12;
                this.hooks.sfx.brush();
                this.hooks.effects.spawn('shine', p.x + (ptr.x - c.x), p.y + (ptr.y - c.y), 2);
              }
            }
          }
          this.lastPointer.set(ptr.id, { x: ptr.x, y: ptr.y });
        }
        for (const id of [...this.lastPointer.keys()]) if (!seen.has(id)) this.lastPointer.delete(id);
        p.ear = Math.max(p.ear, this.groomMeter > 0.5 ? 0.3 : 0);
        if (this.timer > GROOM_TIME || (this.groomMeter >= 1 && this.timer > 3)) {
          this.hooks.effects.say(this.groomMeter > 0.8 ? 'So shiny!' : 'Nice!', p.x, p.y - p.def.hit.h * p.scale - 6, '#fff9c4');
          this.setPhase('walk');
        }
        break;
      }
      case 'walk': {
        const u = 0.25 + this.timer / WALK_TIME;
        const m = lapPoint(u);
        const d = Math.hypot(p.x - m.x, p.y - m.y);
        const closeness = clamp(1 - (d - 34) / 90, 0, 1);
        this.walkScore += (closeness * dt) / WALK_TIME;
        this.competitors.forEach((e, i) => {
          const q = lapPoint(u - 0.14 * (i + 1));
          e.target = { x: q.x, y: q.y };
        });
        if (this.timer > WALK_TIME) {
          this.walkScore = clamp(this.walkScore, 0, 1);
          this.setPhase('pose');
        }
        break;
      }
      case 'pose': {
        this.needle = Math.sin(this.timer * 3.2);
        p.vx = 0;
        p.vy = 0;
        if (this.poseRound >= POSE_ROUNDS && this.poseFeedbackLife <= 0) this.setPhase('judging');
        else if (this.timer > 7 * (this.poseRound + 1) && this.poseRound < POSE_ROUNDS) {
          // Took too long: the judge moves on.
          this.poseScores.push(0.3);
          this.poseRound++;
        }
        break;
      }
      case 'judging': {
        const c = this.ringCenter();
        // Walk the line of cows, then step in front of the player's cow.
        const k = clamp(this.timer / 3.2, 0, 1);
        this.judge.targetX = lerp(c.x - 170, c.x + 130, k);
        this.judge.targetY = RING.y0 + 60;
        if (this.timer > 1 && this.judgeSaid === 0) {
          this.judgeSaid = 1;
          this.hooks.effects.say('Hmm...', this.judge.x, this.judge.y - 96, '#fff9c4');
        }
        if (this.timer > 3.4 && this.judgeSaid === 1) {
          this.judgeSaid = 2;
          this.judge.targetX = c.x + 40;
          this.judge.targetY = c.y + 20;
        }
        if (this.timer > 4.6) this.setPhase('results');
        break;
      }
      case 'results':
        break;
    }
  }

  private updateJudge(dt: number): void {
    const j = this.judge;
    const dx = j.targetX - j.x;
    const dy = j.targetY - j.y;
    const d = Math.hypot(dx, dy);
    if (d > 3) {
      const sp = 70;
      j.x += (dx / d) * sp * dt;
      j.y += (dy / d) * sp * dt;
      j.facing = dx > 0 ? 1 : -1;
      j.moving = lerp(j.moving, 1, 1 - Math.pow(0.001, dt));
      j.walk += dt * 9;
    } else {
      j.moving = lerp(j.moving, 0, 1 - Math.pow(0.001, dt));
      if (this.phase === 'idle' || this.phase === 'intro' || this.phase === 'groom') j.facing = -1;
      if (this.phase === 'results' && this.player) j.facing = this.player.x > j.x ? 1 : -1;
    }
  }

  // ---- drawing --------------------------------------------------------------

  /** World-space extras: the star marker during the walk phase. */
  drawWorld(ctx: CanvasRenderingContext2D, time: number): void {
    if (this.phase === 'walk') {
      const u = 0.25 + this.timer / WALK_TIME;
      const m = lapPoint(u);
      ctx.save();
      ctx.translate(m.x, m.y - 30 + Math.sin(time * 5) * 4);
      ctx.rotate(time * 2);
      ctx.fillStyle = '#ffeb3b';
      ctx.strokeStyle = '#f57f17';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 14 : 6;
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,235,59,0.35)';
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, 30, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Screen-space overlay: instructions, meters, needle and the results card. */
  drawOverlay(ctx: CanvasRenderingContext2D, vw: number, vh: number, portrait: (e: Entity) => HTMLCanvasElement): void {
    if (!this.active || !this.player) return;
    const cx = vw / 2;
    // Instruction banner.
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = Math.min(vw - 40, ctx.measureText(this.message).width + 40);
    const banner = roundRectPath(cx - w / 2, 8, w, 34, 17);
    ctx.fillStyle = 'rgba(40,53,147,0.92)';
    ctx.fill(banner);
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.stroke(banner);
    ctx.fillStyle = '#fff';
    ctx.fillText(this.message, cx, 25);

    if (this.phase === 'groom') {
      this.drawMeter(ctx, cx, 54, 220, this.groomMeter, '#fff176', 'Shine');
      const left = Math.max(0, GROOM_TIME - this.timer);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${Math.ceil(left)}s`, cx + 130, 60);
    } else if (this.phase === 'walk') {
      this.drawMeter(ctx, cx, 54, 220, clamp(this.walkScore * (WALK_TIME / Math.max(0.1, this.timer)), 0, 1), '#81c784', 'Judge likes it');
      const left = Math.max(0, WALK_TIME - this.timer);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${Math.ceil(left)}s`, cx + 130, 60);
    } else if (this.phase === 'pose') {
      // Needle bar with a green centre zone.
      const bw = 240;
      const bx = cx - bw / 2;
      const by = 52;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill(roundRectPath(bx, by, bw, 18, 9));
      ctx.fillStyle = '#ffcc80';
      ctx.fillRect(bx + bw * 0.3, by + 2, bw * 0.4, 14);
      ctx.fillStyle = '#66bb6a';
      ctx.fillRect(bx + bw * 0.42, by + 2, bw * 0.16, 14);
      const nx = bx + bw / 2 + (this.needle * bw) / 2;
      ctx.fillStyle = '#d32f2f';
      ctx.beginPath();
      ctx.moveTo(nx, by - 4);
      ctx.lineTo(nx + 6, by - 12);
      ctx.lineTo(nx - 6, by - 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(nx - 1.5, by - 4, 3, 26);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${Math.min(POSE_ROUNDS, this.poseRound + 1)} / ${POSE_ROUNDS}`, cx + 140, by + 9);
      if (this.poseFeedbackLife > 0) {
        ctx.font = 'bold 22px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#1b5e20';
        ctx.lineWidth = 4;
        ctx.strokeText(this.poseFeedback, cx, by + 44);
        ctx.fillText(this.poseFeedback, cx, by + 44);
      }
    } else if (this.phase === 'results') {
      const pop = Math.min(1, this.timer / 0.4);
      const ease = 1 - Math.pow(1 - pop, 3);
      const cw = Math.min(380, vw - 40);
      const rowH = 44;
      const ch = 60 + this.results.length * rowH + 30;
      const x0 = cx - cw / 2;
      const y0 = Math.max(52, vh / 2 - ch / 2) + (1 - ease) * 60;
      const card = roundRectPath(x0, y0, cw, ch, 18);
      ctx.globalAlpha = ease;
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.fill(card);
      ctx.strokeStyle = '#7e57c2';
      ctx.lineWidth = 4;
      ctx.stroke(card);
      ctx.fillStyle = '#283593';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('Show Results', cx, y0 + 26);
      this.results.forEach((r, i) => {
        const y = y0 + 52 + i * rowH;
        const mine = r.entity === this.player;
        if (mine) {
          ctx.fillStyle = '#fff8e1';
          ctx.fill(roundRectPath(x0 + 10, y - 2, cw - 20, rowH - 4, 10));
        }
        ctx.drawImage(portrait(r.entity), x0 + 16, y, 36, 36);
        ctx.fillStyle = '#263238';
        ctx.font = `bold ${mine ? 15 : 14}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`${r.rank}. ${r.entity.def.name}`, x0 + 60, y + 11);
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#607d8b';
        ctx.fillText(`${r.entity.def.breed} • ${r.points} points`, x0 + 60, y + 27);
        ctx.textAlign = 'center';
        drawRosette(ctx, x0 + cw - 40, y + 14, 11, RIBBON_COLORS[r.ribbon]);
      });
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#78909c';
      ctx.fillText('Tap to leave the ring', cx, y0 + ch - 16);
      ctx.globalAlpha = 1;
    }
  }

  private drawMeter(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, v: number, color: string, label: string): void {
    const x = cx - w / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill(roundRectPath(x, y, w, 16, 8));
    ctx.fillStyle = color;
    ctx.fill(roundRectPath(x + 2, y + 2, Math.max(8, (w - 4) * clamp(v, 0, 1)), 12, 6));
    ctx.fillStyle = '#263238';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, y + 8);
  }
}

/** Prompt shown at the bottom of the screen when a cow is standing in the ring. */
export function drawStartPrompt(ctx: CanvasRenderingContext2D, vw: number, vh: number, time: number): { x: number; y: number; w: number; h: number } {
  const w = 240;
  const h = 44;
  const x = vw / 2 - w / 2;
  const y = vh - 70 + Math.sin(time * 4) * 3;
  const path = roundRectPath(x, y, w, h, 22);
  ctx.fillStyle = '#7e57c2';
  ctx.fill(path);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke(path);
  drawRosette(ctx, x + 28, y + 20, 11, '#ffd54f');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Start the Cow Show!', x + w / 2 + 14, y + h / 2);
  return { x, y, w, h };
}

/**
 * The red stall banners in the show barn: one plaque per cow with her name,
 * breed and the ribbons she has won, like the banners at a real fair.
 */
export function drawStallBanners(
  ctx: CanvasRenderingContext2D,
  cows: Entity[],
  ribbons: (id: string) => Ribbon[],
  dark: number,
): void {
  cows.forEach((cow, i) => {
    const x = STALLS.x0 + i * STALLS.stallW + STALLS.stallW / 2;
    const plaque = roundRectPath(x - 31, -108, 62, 26, 3);
    ctx.fillStyle = mixColor('#1a237e', '#0a0d33', dark * 0.6);
    ctx.fill(plaque);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke(plaque);
    ctx.fillStyle = '#fff';
    ctx.font = 'italic bold 10px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cow.def.name, x, -100);
    ctx.font = '6px sans-serif';
    ctx.fillStyle = '#ffd54f';
    ctx.fillText(cow.def.breed, x, -90, 58);
    // Owner line and the rosettes.
    ctx.fillStyle = '#e8eaf6';
    ctx.font = '5px sans-serif';
    ctx.fillText('Owned by: You', x, -85, 58);
    const won = ribbons(cow.def.id).slice(-4);
    won.forEach((rb, k) => drawRosette(ctx, x - 18 + k * 12, -74, 4.5, RIBBON_COLORS[rb]));
  });
}

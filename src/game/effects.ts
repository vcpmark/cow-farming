/** Speech bubbles, particles and little props (eggs) that make actions feel alive. */
import { roundRectPath } from './util';

export type ParticleKind = 'heart' | 'note' | 'dust' | 'grass' | 'splash' | 'smoke' | 'sparkle' | 'zzz' | 'star' | 'confetti' | 'shine';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color?: string;
}

export interface Bubble {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  color: string;
}

export class Effects {
  particles: Particle[] = [];
  bubbles: Bubble[] = [];

  spawn(kind: ParticleKind, x: number, y: number, count = 1, opts: Partial<Particle> = {}): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 40;
      const base: Particle = {
        kind,
        x: x + (Math.random() - 0.5) * 16,
        y,
        vx: Math.cos(a) * sp,
        vy: -Math.abs(Math.sin(a) * sp) - 20,
        life: 0,
        maxLife: 0.9 + Math.random() * 0.6,
        size: 5 + Math.random() * 4,
      };
      if (kind === 'dust') Object.assign(base, { vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 15, maxLife: 0.5, size: 3 + Math.random() * 3 });
      if (kind === 'smoke') Object.assign(base, { vx: -10 + Math.random() * 10, vy: -40 - Math.random() * 20, maxLife: 1.2, size: 5 + Math.random() * 4 });
      if (kind === 'splash') Object.assign(base, { vy: -60 - Math.random() * 60, vx: (Math.random() - 0.5) * 90, maxLife: 0.7, size: 3 + Math.random() * 3 });
      if (kind === 'grass') Object.assign(base, { vy: -30 - Math.random() * 30, vx: (Math.random() - 0.5) * 50, maxLife: 0.6, size: 3 });
      if (kind === 'zzz') Object.assign(base, { vx: 6, vy: -14, maxLife: 2.2, size: 8 });
      if (kind === 'sparkle') Object.assign(base, { vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, maxLife: 0.6 + Math.random() * 0.4, size: 4 + Math.random() * 5 });
      if (kind === 'confetti')
        Object.assign(base, {
          vx: (Math.random() - 0.5) * 160,
          vy: -120 - Math.random() * 120,
          maxLife: 1.8 + Math.random() * 0.8,
          size: 3 + Math.random() * 3,
          color: ['#ef5350', '#42a5f5', '#ffee58', '#66bb6a', '#ab47bc', '#ffa726'][Math.floor(Math.random() * 6)],
        });
      if (kind === 'shine') Object.assign(base, { vx: (Math.random() - 0.5) * 20, vy: -20 - Math.random() * 20, maxLife: 0.5, size: 3 + Math.random() * 3, color: '#ffffff' });
      this.particles.push({ ...base, ...opts });
    }
  }

  say(text: string, x: number, y: number, color = '#fff'): void {
    this.bubbles = this.bubbles.filter((b) => Math.abs(b.x - x) > 40 || Math.abs(b.y - y) > 40);
    this.bubbles.push({ text, x, y, life: 0, maxLife: 1.6, color });
  }

  update(dt: number): void {
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'splash' || p.kind === 'grass') p.vy += 220 * dt;
      if (p.kind === 'confetti') {
        p.vy += 160 * dt;
        p.vx *= 0.98;
      }
      if (p.kind === 'heart' || p.kind === 'note') p.vy -= 20 * dt;
      if (p.kind === 'sparkle') {
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
    }
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
    for (const b of this.bubbles) b.life += dt;
    this.bubbles = this.bubbles.filter((b) => b.life < b.maxLife);
  }

  /** Draw in world space (camera already applied). */
  drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const k = p.life / p.maxLife;
      const alpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(p.x, p.y);
      switch (p.kind) {
        case 'heart':
          ctx.fillStyle = p.color ?? '#ff5c8a';
          ctx.scale(p.size / 10, p.size / 10);
          ctx.beginPath();
          ctx.moveTo(0, 4);
          ctx.bezierCurveTo(-8, -3, -5, -10, 0, -5);
          ctx.bezierCurveTo(5, -10, 8, -3, 0, 4);
          ctx.fill();
          break;
        case 'note':
          ctx.fillStyle = p.color ?? '#3f51b5';
          ctx.strokeStyle = ctx.fillStyle;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(-2, 4, 3.5, 2.5, -0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(1, 3);
          ctx.lineTo(1, -8);
          ctx.quadraticCurveTo(4, -8, 6, -5);
          ctx.stroke();
          break;
        case 'dust':
          ctx.fillStyle = p.color ?? 'rgba(200,170,120,0.6)';
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (0.6 + k), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'smoke':
          ctx.fillStyle = `rgba(80,80,80,${0.5 * (1 - k)})`;
          ctx.beginPath();
          ctx.arc(0, 0, p.size * (0.5 + k * 1.5), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'grass':
          ctx.fillStyle = '#4c9a3c';
          ctx.fillRect(-1, -3, 2, 6);
          break;
        case 'splash':
          ctx.fillStyle = 'rgba(120,190,240,0.9)';
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'confetti':
          ctx.fillStyle = p.color ?? '#fff';
          ctx.rotate(p.life * 5 + p.x);
          ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
          break;
        case 'shine':
        case 'sparkle':
        case 'star': {
          ctx.fillStyle = p.color ?? '#fff176';
          ctx.rotate(p.life * 6);
          const r = p.size * (1 - k * 0.5);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const rr = i % 2 === 0 ? r : r * 0.4;
            const a = (i / 8) * Math.PI * 2;
            ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'zzz':
          ctx.fillStyle = '#fff';
          ctx.strokeStyle = '#3949ab';
          ctx.lineWidth = 3;
          ctx.font = `bold ${p.size + k * 6}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.strokeText('z', 0, 0);
          ctx.fillText('z', 0, 0);
          break;
      }
      ctx.restore();
    }
  }

  drawBubbles(ctx: CanvasRenderingContext2D): void {
    for (const b of this.bubbles) {
      const k = b.life / b.maxLife;
      const pop = Math.min(1, b.life / 0.15);
      const scale = 0.6 + 0.4 * (1 - Math.pow(1 - pop, 3));
      const alpha = k < 0.75 ? 1 : 1 - (k - 0.75) / 0.25;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(b.x, b.y - k * 10);
      ctx.scale(scale, scale);
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(b.text).width + 20;
      const h = 28;
      const path = roundRectPath(-w / 2, -h - 10, w, h, 12);
      ctx.fillStyle = b.color;
      ctx.fill(path);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke(path);
      ctx.beginPath();
      ctx.moveTo(-6, -10);
      ctx.lineTo(0, -2);
      ctx.lineTo(6, -10);
      ctx.closePath();
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.fillStyle = '#2b2b2b';
      ctx.fillText(b.text, 0, -h / 2 - 10);
      ctx.restore();
    }
  }
}

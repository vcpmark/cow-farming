/** Shared painting helpers used by every species renderer. */
import { shade } from '../util';

export interface Fill {
  path: Path2D;
  color: string;
}

/**
 * Paints a body part: clips to it, fills the base colour, paints any markings
 * (already expressed in the same coordinate space), then applies a soft
 * top-light / under-shadow gradient so the shape reads as a solid animal.
 */
export function paintPart(
  ctx: CanvasRenderingContext2D,
  part: Path2D,
  base: string,
  markings: Fill[] = [],
  shadeRange: [number, number] = [-80, 0],
  strength = 1,
): void {
  ctx.save();
  ctx.clip(part);
  ctx.fillStyle = base;
  ctx.fill(part);
  for (const m of markings) {
    ctx.fillStyle = m.color;
    ctx.fill(m.path);
  }
  const g = ctx.createLinearGradient(0, shadeRange[0], 0, shadeRange[1]);
  g.addColorStop(0, `rgba(255,255,255,${0.14 * strength})`);
  g.addColorStop(0.4, 'rgba(255,255,255,0)');
  g.addColorStop(0.65, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.3 * strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(-300, -300, 600, 600);
  ctx.restore();
}

export function strokePart(ctx: CanvasRenderingContext2D, part: Path2D, width = 1.3, alpha = 0.45): void {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(30,20,15,${alpha})`;
  ctx.lineWidth = width;
  ctx.stroke(part);
}

/** Darkens a far-side limb so it reads as being behind the body. */
export function darkenPart(ctx: CanvasRenderingContext2D, part: Path2D, alpha = 0.28): void {
  ctx.save();
  ctx.clip(part);
  ctx.fillStyle = `rgba(20,12,8,${alpha})`;
  ctx.fillRect(-300, -300, 600, 600);
  ctx.restore();
}

/** A simple animal eye with highlight, optional lid. */
export function drawEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  iris: string,
  blink: number,
  lash = false,
): void {
  const open = Math.max(0.08, 1 - blink);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.15, r * open, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(x + r * 0.1, y, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x + r * 0.4, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(30,20,15,0.6)';
  ctx.lineWidth = Math.max(0.7, r * 0.25);
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.2, r * open, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  if (lash) {
    ctx.lineWidth = Math.max(0.6, r * 0.2);
    for (let i = 0; i < 3; i++) {
      const a = -2.3 + i * 0.5;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a) * r * 1.9, y + Math.sin(a) * r * 1.7);
      ctx.stroke();
    }
  }
}

/** Fur/hair tufts hanging from a set of anchor points. */
export function drawTufts(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  color: string,
  len: number,
  rng: () => number,
  t: number,
  dir = 1,
): void {
  const colors = [color, shade(color, -0.2), shade(color, 0.15)];
  ctx.lineCap = 'round';
  for (const p of points) {
    ctx.strokeStyle = colors[Math.floor(rng() * 3)];
    ctx.lineWidth = 1.2 + rng();
    const l = len * (0.7 + rng() * 0.6);
    const sway = Math.sin(t * 2 + p.x * 0.2) * 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.quadraticCurveTo(p.x + (rng() - 0.5) * 4 + sway, p.y + l * 0.5 * dir, p.x + (rng() - 0.5) * 6 + sway, p.y + l * dir);
    ctx.stroke();
  }
}

/** Common animated pose shared by all species. */
export interface Pose {
  walk: number;
  moving: number;
  headDown: number;
  chew: number;
  tail: number;
  ear: number;
  blink: number;
  t: number;
  /** Extra per-species action intensity (jump, wag, flap) 0..1. */
  action: number;
}

export const IDLE_POSE: Pose = {
  walk: 0,
  moving: 0,
  headDown: 0,
  chew: 0,
  tail: 0,
  ear: 0,
  blink: 0,
  t: 0,
  action: 0,
};

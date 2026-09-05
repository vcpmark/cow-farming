// Small shared helpers: math, seeded randomness, colours and path utilities.

export interface Vec {
  x: number;
  y: number;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);
export const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

/** Deterministic pseudo random generator (mulberry32). Same seed => same animal markings. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ---- colours -------------------------------------------------------------

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Darken (negative) or lighten (positive) a hex colour by a fraction. */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (amount >= 0) {
    return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
  }
  const k = 1 + amount;
  return rgbToHex(r * k, g * k, b * k);
}

export function mixColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---- paths ---------------------------------------------------------------

/** Point on a cubic bezier. */
export function cubicPoint(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/**
 * Builds an organic blob (used for cow patches, mud puddles, tree canopies).
 * Points are deterministic for a given rng so markings never flicker.
 */
export function blobPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rng: () => number,
  wobble = 0.35,
  points = 9,
): Path2D {
  const path = new Path2D();
  const pts: Vec[] = [];
  const rot = rng() * Math.PI * 2;
  for (let i = 0; i < points; i++) {
    const a = rot + (i / points) * Math.PI * 2;
    const k = 1 - wobble / 2 + rng() * wobble;
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  // Smooth closed curve through the points using midpoint quadratic curves.
  const n = pts.length;
  const mid = (i: number): Vec => ({
    x: (pts[i % n].x + pts[(i + 1) % n].x) / 2,
    y: (pts[i % n].y + pts[(i + 1) % n].y) / 2,
  });
  const m0 = mid(0);
  path.moveTo(m0.x, m0.y);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n];
    const m = mid(i);
    path.quadraticCurveTo(p.x, p.y, m.x, m.y);
  }
  path.closePath();
  return path;
}

/** Rounded rectangle path helper (Safari friendly, avoids relying on ctx.roundRect). */
export function roundRectPath(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  const rr = Math.min(r, w / 2, h / 2);
  p.moveTo(x + rr, y);
  p.lineTo(x + w - rr, y);
  p.quadraticCurveTo(x + w, y, x + w, y + rr);
  p.lineTo(x + w, y + h - rr);
  p.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  p.lineTo(x + rr, y + h);
  p.quadraticCurveTo(x, y + h, x, y + h - rr);
  p.lineTo(x, y + rr);
  p.quadraticCurveTo(x, y, x + rr, y);
  p.closePath();
  return p;
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

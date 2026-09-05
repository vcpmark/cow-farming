/**
 * The farm world: layout constants, the areas the animals live in, and the
 * background / ground rendering with a day-night cycle.
 */
import { blobPath, clamp, lerp, makeRng, mixColor, roundRectPath, shade } from './util';

export const WORLD_WIDTH = 6420;
export const VIEW_H = 420;
/** Horizon line where the far hills meet the ground. */
export const HORIZON = 232;
/** Ground band the characters walk on. */
export const GROUND_TOP = 262;
export const GROUND_BOTTOM = 404;
export const DAY_LENGTH = 240; // seconds for a full day

export interface Area {
  id: string;
  x0: number;
  x1: number;
  label: string;
}

export const AREAS: Area[] = [
  { id: 'house', x0: 60, x1: 540, label: 'Farmhouse' },
  { id: 'barn', x0: 560, x1: 1830, label: 'Cow Pasture' },
  { id: 'pond', x0: 1850, x1: 2310, label: 'Duck Pond' },
  { id: 'coop', x0: 2330, x1: 2670, label: 'Chicken Coop' },
  { id: 'pigs', x0: 2680, x1: 2940, label: 'Pig Pen' },
  { id: 'sheep', x0: 2960, x1: 3480, label: 'Sheep Field' },
  { id: 'horses', x0: 3500, x1: 4130, label: 'Horse Paddock' },
  { id: 'field', x0: 4150, x1: 4800, label: 'Tractor Shed' },
  { id: 'fair', x0: 4840, x1: 6400, label: 'Cow Show' },
];

export const POND = { x: 2090, y: 352, rx: 190, ry: 42 };
/** The show ring at the fair: a wood-shavings floor fenced with white panels. */
export const RING = { x0: 5840, x1: 6300, y0: GROUND_TOP + 12, y1: GROUND_BOTTOM - 2 };
/** The show barn stall row, one stall per cow. */
export const STALLS = { x0: 4900, stallW: 70 };

export function inRing(x: number, y: number): boolean {
  return x > RING.x0 && x < RING.x1 && y > RING.y0 - 6 && y < RING.y1 + 4;
}
/** Wood shavings ring: a little tan for the sun, darker at night. */
export const MUD = { x: 2820, y: 360, rx: 90, ry: 26 };

export function depthScale(y: number): number {
  return lerp(0.7, 1.05, clamp((y - GROUND_TOP) / (GROUND_BOTTOM - GROUND_TOP), 0, 1));
}

export function inPond(x: number, y: number): boolean {
  const dx = (x - POND.x) / (POND.rx * 0.92);
  const dy = (y - POND.y) / (POND.ry * 0.92);
  return dx * dx + dy * dy < 1;
}

export function inMud(x: number, y: number): boolean {
  const dx = (x - MUD.x) / MUD.rx;
  const dy = (y - MUD.y) / MUD.ry;
  return dx * dx + dy * dy < 1;
}

// ---- time of day ---------------------------------------------------------

export interface Daylight {
  /** 0..1 fraction of the day. */
  t: number;
  /** 0 = full night, 1 = full day. */
  light: number;
  skyTop: string;
  skyBottom: string;
  sunX: number;
  sunY: number;
  isNight: boolean;
}

function keyColor(t: number, keys: [number, string][]): string {
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, c0] = keys[i];
    const [t1, c1] = keys[i + 1];
    if (t >= t0 && t <= t1) return mixColor(c0, c1, (t - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1];
}

export function daylight(time: number): Daylight {
  const t = (time / DAY_LENGTH) % 1;
  const skyTop = keyColor(t, [
    [0, '#f9a86b'],
    [0.08, '#5aa7e8'],
    [0.5, '#4a9be6'],
    [0.6, '#f08a5d'],
    [0.68, '#1b2447'],
    [0.94, '#1b2447'],
    [1, '#f9a86b'],
  ]);
  const skyBottom = keyColor(t, [
    [0, '#ffd9a0'],
    [0.08, '#bfe6ff'],
    [0.5, '#c8ecff'],
    [0.6, '#ffc177'],
    [0.68, '#2f3b6e'],
    [0.94, '#2f3b6e'],
    [1, '#ffd9a0'],
  ]);
  const light = t < 0.62 ? 1 : t < 0.7 ? 1 - (t - 0.62) / 0.08 : t < 0.92 ? 0 : (t - 0.92) / 0.08;
  const dayFrac = clamp(t / 0.66, 0, 1); // sun travels during the first 66%
  const sunX = lerp(-0.1, 1.1, dayFrac);
  const sunY = 0.85 - Math.sin(dayFrac * Math.PI) * 0.75;
  return { t, light: clamp(light, 0, 1), skyTop, skyBottom, sunX, sunY, isNight: light < 0.35 };
}

// ---- background drawing --------------------------------------------------

interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}
const clouds: Cloud[] = (() => {
  const rng = makeRng(7);
  const out: Cloud[] = [];
  for (let i = 0; i < 9; i++) out.push({ x: rng() * 2000, y: 20 + rng() * 90, s: 0.7 + rng() * 0.8, v: 4 + rng() * 6 });
  return out;
})();

const stars = (() => {
  const rng = makeRng(99);
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 70; i++) out.push({ x: rng() * 1000, y: rng() * 200, r: 0.5 + rng() * 1.2 });
  return out;
})();

export function drawSky(ctx: CanvasRenderingContext2D, viewW: number, camX: number, dl: Daylight, time: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, dl.skyTop);
  g.addColorStop(1, dl.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, HORIZON + 4);

  // Stars at night
  if (dl.light < 0.6) {
    ctx.fillStyle = `rgba(255,255,240,${(0.6 - dl.light) * 1.4})`;
    for (const s of stars) {
      const x = ((s.x - camX * 0.02) % 1000 + 1000) % 1000;
      const tw = 0.7 + Math.sin(time * 2 + s.x) * 0.3;
      for (let k = 0; k * 1000 < viewW + 1000; k++) {
        ctx.beginPath();
        ctx.arc(x + k * 1000 - 500, s.y, s.r * tw, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Sun or moon
  const sx = dl.sunX * viewW;
  const sy = dl.sunY * HORIZON;
  if (dl.t < 0.7 || dl.t > 0.9) {
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60);
    glow.addColorStop(0, 'rgba(255,240,180,0.9)');
    glow.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 60, sy - 60, 120, 120);
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(sx, sy, 22, 0, Math.PI * 2);
    ctx.fill();
  }
  if (dl.light < 0.5) {
    const mx = viewW * (1 - (dl.t - 0.6) / 0.4);
    const my = 60;
    ctx.fillStyle = `rgba(245,240,220,${(0.5 - dl.light) * 2})`;
    ctx.beginPath();
    ctx.arc(mx, my, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(200,195,180,${(0.5 - dl.light) * 1.2})`;
    for (const [cx, cy, r] of [
      [-6, -4, 4],
      [5, 5, 3],
      [7, -7, 2],
    ]) {
      ctx.beginPath();
      ctx.arc(mx + cx, my + cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Clouds (slow parallax)
  for (const c of clouds) {
    const x = ((c.x + time * c.v - camX * 0.15) % (viewW + 300) + viewW + 300) % (viewW + 300) - 150;
    ctx.fillStyle = `rgba(255,255,255,${0.55 + dl.light * 0.35})`;
    for (const [dx, dy, r] of [
      [0, 0, 22],
      [-22, 6, 16],
      [22, 6, 17],
      [8, -8, 16],
      [-10, -6, 14],
    ]) {
      ctx.beginPath();
      ctx.arc(x + dx * c.s, c.y + dy * c.s, r * c.s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Far mountains and hills (two parallax layers)
  const mount = mixColor('#7fa6c9', '#2a3556', 1 - dl.light);
  drawHills(ctx, viewW, camX * 0.25, HORIZON - 40, 70, 300, mount, 1);
  const hill = mixColor('#6fae52', '#22432a', 1 - dl.light);
  drawHills(ctx, viewW, camX * 0.5, HORIZON - 4, 34, 180, hill, 2);
}

function drawHills(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  scroll: number,
  base: number,
  amp: number,
  wave: number,
  color: string,
  seed: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 20);
  for (let x = 0; x <= viewW; x += 8) {
    const wx = x + scroll;
    const y = base - amp * (0.5 + 0.5 * Math.sin(wx / wave + seed)) * (0.6 + 0.4 * Math.sin(wx / (wave * 0.37) + seed * 2));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(viewW, base + 20);
  ctx.closePath();
  ctx.fill();
}

// Deterministic ground detail: grass tufts, flowers, stones.
const groundDetail = (() => {
  const rng = makeRng(2024);
  const tufts: { x: number; y: number; k: number; s: number }[] = [];
  for (let i = 0; i < 900; i++) {
    tufts.push({ x: rng() * WORLD_WIDTH, y: GROUND_TOP + rng() * (GROUND_BOTTOM - GROUND_TOP + 12), k: Math.floor(rng() * 4), s: 0.7 + rng() * 0.6 });
  }
  return tufts;
})();

export function drawGround(ctx: CanvasRenderingContext2D, viewW: number, camX: number, dl: Daylight): void {
  const dark = 1 - dl.light;
  const far = mixColor('#7cc04f', '#213b22', dark * 0.75);
  const near = mixColor('#9ad25b', '#2c4d2a', dark * 0.75);
  const g = ctx.createLinearGradient(0, HORIZON, 0, VIEW_H);
  g.addColorStop(0, far);
  g.addColorStop(1, near);
  ctx.fillStyle = g;
  ctx.fillRect(0, HORIZON, viewW, VIEW_H - HORIZON);

  ctx.save();
  ctx.translate(-camX, 0);

  // Dirt path running along the farm.
  ctx.fillStyle = mixColor('#c9a76a', '#4a3d2a', dark * 0.7);
  ctx.beginPath();
  ctx.moveTo(-50, 372);
  for (let x = -50; x <= WORLD_WIDTH + 50; x += 60) ctx.lineTo(x, 366 + Math.sin(x / 140) * 5);
  ctx.lineTo(WORLD_WIDTH + 50, 388);
  for (let x = WORLD_WIDTH + 50; x >= -50; x -= 60) ctx.lineTo(x, 384 + Math.sin(x / 170 + 1) * 5);
  ctx.closePath();
  ctx.fill();

  // Wheat field in the crop area (background band).
  {
    const x0 = 4160;
    const x1 = 4800;
    if (x1 > camX - 50 && x0 < camX + viewW + 50) {
      ctx.fillStyle = mixColor('#8a6b3d', '#3a2d1a', dark * 0.7);
      ctx.fillRect(x0, HORIZON + 2, x1 - x0, GROUND_TOP - HORIZON - 2);
      const wheat = mixColor('#e2c35b', '#5a4a24', dark * 0.7);
      ctx.strokeStyle = wheat;
      ctx.lineWidth = 2;
      for (let x = x0 + 6; x < x1; x += 9) {
        const h = 14 + ((x * 7) % 5);
        ctx.beginPath();
        ctx.moveTo(x, GROUND_TOP);
        ctx.lineTo(x + 1.5, GROUND_TOP - h);
        ctx.stroke();
        ctx.fillStyle = wheat;
        ctx.beginPath();
        ctx.ellipse(x + 1.5, GROUND_TOP - h - 2, 2, 4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Fairground: straw bedding under the stall banners and the shavings floor of the ring.
  if (5900 > camX - 50 && 4800 < camX + viewW + 50) {
    ctx.fillStyle = mixColor('#e8d48a', '#4d4629', dark * 0.7);
    ctx.fillRect(STALLS.x0 - 10, GROUND_TOP + 2, 12 * STALLS.stallW + 20, 62);
    ctx.strokeStyle = mixColor('#c9b15a', '#3a3320', dark * 0.7);
    ctx.lineWidth = 1;
    for (let i = 0; i < 90; i++) {
      const x = STALLS.x0 - 6 + ((i * 37) % (12 * STALLS.stallW + 12));
      const y = GROUND_TOP + 6 + ((i * 53) % 54);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y + 2);
      ctx.stroke();
    }
    // rubber mat walkway in front of the stalls
    ctx.fillStyle = mixColor('#5f6368', '#1e2022', dark * 0.7);
    ctx.fillRect(STALLS.x0 - 10, GROUND_TOP + 64, 12 * STALLS.stallW + 20, 10);
  }
  if (RING.x1 > camX - 50 && RING.x0 < camX + viewW + 50) {
    const floor = roundRectPath(RING.x0, RING.y0, RING.x1 - RING.x0, RING.y1 - RING.y0, 30);
    ctx.fillStyle = mixColor('#d9c27a', '#4a4128', dark * 0.7);
    ctx.fill(floor);
    ctx.save();
    ctx.clip(floor);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 160; i++) {
      const x = RING.x0 + ((i * 97) % (RING.x1 - RING.x0));
      const y = RING.y0 + ((i * 61) % (RING.y1 - RING.y0));
      ctx.fillRect(x, y, 3, 1.5);
    }
    ctx.restore();
  }

  // Plough furrows in front of the shed.
  {
    ctx.strokeStyle = mixColor('#a3865a', '#3e3220', dark * 0.7);
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const y = GROUND_TOP + 14 + i * 16;
      if (y > 360) break;
      ctx.beginPath();
      ctx.moveTo(4440, y);
      ctx.lineTo(4780, y);
      ctx.stroke();
    }
  }

  // Mud in the pig pen.
  ctx.fillStyle = mixColor('#6d4b2b', '#2b1e12', dark * 0.7);
  ctx.fill(blobPath(MUD.x, MUD.y, MUD.rx, MUD.ry, makeRng(5), 0.25, 12));
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill(blobPath(MUD.x - 20, MUD.y - 6, MUD.rx * 0.4, MUD.ry * 0.3, makeRng(6), 0.3, 8));

  // Pond.
  {
    const water = ctx.createLinearGradient(0, POND.y - POND.ry, 0, POND.y + POND.ry);
    water.addColorStop(0, mixColor('#63b3e6', '#1c3550', dark * 0.8));
    water.addColorStop(1, mixColor('#3f8fc7', '#12243a', dark * 0.8));
    ctx.fillStyle = mixColor('#c7b07a', '#3e3626', dark * 0.7); // sandy bank
    ctx.fill(blobPath(POND.x, POND.y, POND.rx + 12, POND.ry + 8, makeRng(11), 0.15, 14));
    ctx.fillStyle = water;
    ctx.fill(blobPath(POND.x, POND.y, POND.rx, POND.ry, makeRng(11), 0.15, 14));
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(POND.x - 120 + i * 50, POND.y - 12 + i * 8);
      ctx.quadraticCurveTo(POND.x - 100 + i * 50, POND.y - 16 + i * 8, POND.x - 80 + i * 50, POND.y - 12 + i * 8);
      ctx.stroke();
    }
    // lily pads
    ctx.fillStyle = mixColor('#4fa85a', '#1d3d22', dark * 0.6);
    for (const [px, py] of [
      [POND.x + 90, POND.y + 10],
      [POND.x + 110, POND.y + 20],
      [POND.x - 140, POND.y + 16],
    ]) {
      ctx.beginPath();
      ctx.ellipse(px, py, 9, 4.5, 0, 0.3, Math.PI * 2 - 0.3);
      ctx.lineTo(px, py);
      ctx.fill();
    }
  }

  // Grass tufts, flowers and stones.
  const grassC = mixColor('#5f9c3a', '#1f3a1f', dark * 0.7);
  for (const t of groundDetail) {
    if (t.x < camX - 20 || t.x > camX + viewW + 20) continue;
    if (inPond(t.x, t.y) || inMud(t.x, t.y)) continue;
    if (t.y > 362 && t.y < 392) continue; // path
    if (inRing(t.x, t.y)) continue; // wood shavings
    if (t.x > STALLS.x0 - 12 && t.x < STALLS.x0 + 12 * STALLS.stallW + 12 && t.y < GROUND_TOP + 76) continue; // stall bedding
    if (t.k === 3) {
      // flower
      ctx.fillStyle = ['#ffeb3b', '#ff8a80', '#f8bbd0', '#fff'][Math.floor(t.x) % 4];
      ctx.globalAlpha = 0.5 + dl.light * 0.5;
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, 2.4 * t.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = grassC;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(t.x, t.y - 2);
      ctx.lineTo(t.x, t.y + 2);
      ctx.stroke();
    } else if (t.k === 2 && t.x > 2960 && t.x < 3480) {
      ctx.fillStyle = mixColor('#a8a8a0', '#3a3a38', dark * 0.7);
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, 4 * t.s, 2.5 * t.s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = grassC;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let b = -1; b <= 1; b++) {
        ctx.moveTo(t.x, t.y);
        ctx.lineTo(t.x + b * 3 * t.s, t.y - 6 * t.s);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---- buildings and props ---------------------------------------------------

export interface Prop {
  x: number;
  y: number;
  draw: (ctx: CanvasRenderingContext2D, dark: number, time: number) => void;
  /** Half width for culling. */
  w: number;
}

function drawBarn(ctx: CanvasRenderingContext2D, dark: number): void {
  const red = mixColor('#b7332c', '#3a1512', dark * 0.7);
  const white = mixColor('#f4efe6', '#4a4640', dark * 0.7);
  const roof = mixColor('#5b3a2a', '#1f1410', dark * 0.7);
  // main body
  ctx.fillStyle = red;
  ctx.fillRect(-110, -120, 220, 120);
  // gambrel roof
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(-124, -118);
  ctx.lineTo(-80, -166);
  ctx.lineTo(0, -190);
  ctx.lineTo(80, -166);
  ctx.lineTo(124, -118);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // big doors
  ctx.fillStyle = mixColor('#8d2620', '#2a0c0a', dark * 0.7);
  ctx.fillRect(-42, -80, 84, 80);
  ctx.strokeStyle = white;
  ctx.lineWidth = 4;
  ctx.strokeRect(-42, -80, 84, 80);
  ctx.beginPath();
  ctx.moveTo(-42, -80);
  ctx.lineTo(0, -40);
  ctx.lineTo(42, -80);
  ctx.moveTo(-42, 0);
  ctx.lineTo(0, -40);
  ctx.lineTo(42, 0);
  ctx.moveTo(0, -80);
  ctx.lineTo(0, 0);
  ctx.stroke();
  // hay loft window
  ctx.fillStyle = mixColor('#2f2320', '#0e0a09', dark * 0.5);
  ctx.fillRect(-16, -150, 32, 26);
  ctx.strokeStyle = white;
  ctx.lineWidth = 3;
  ctx.strokeRect(-16, -150, 32, 26);
  // trim
  ctx.strokeRect(-110, -120, 220, 120);
  // side windows
  for (const wx of [-85, 62]) {
    ctx.fillStyle = dark > 0.5 ? '#ffd76a' : mixColor('#bfe3f5', '#334', dark);
    ctx.fillRect(wx, -100, 24, 22);
    ctx.strokeStyle = white;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(wx, -100, 24, 22);
    ctx.beginPath();
    ctx.moveTo(wx + 12, -100);
    ctx.lineTo(wx + 12, -78);
    ctx.moveTo(wx, -89);
    ctx.lineTo(wx + 24, -89);
    ctx.stroke();
  }
}

function drawSilo(ctx: CanvasRenderingContext2D, dark: number): void {
  const body = mixColor('#c9c3b5', '#3f3c36', dark * 0.7);
  ctx.fillStyle = body;
  ctx.fillRect(-28, -170, 56, 170);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(14, -170, 14, 170);
  ctx.fillStyle = mixColor('#8d2620', '#2a0c0a', dark * 0.7);
  ctx.beginPath();
  ctx.arc(0, -170, 28, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  for (let y = -150; y < 0; y += 30) {
    ctx.beginPath();
    ctx.moveTo(-28, y);
    ctx.lineTo(28, y);
    ctx.stroke();
  }
  ctx.strokeRect(-28, -170, 56, 170);
}

function drawHouse(ctx: CanvasRenderingContext2D, dark: number): void {
  const wall = mixColor('#f6e7c8', '#4d4638', dark * 0.7);
  const roof = mixColor('#7d5a44', '#2a1d15', dark * 0.7);
  ctx.fillStyle = wall;
  ctx.fillRect(-90, -100, 180, 100);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(-104, -98);
  ctx.lineTo(0, -160);
  ctx.lineTo(104, -98);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeRect(-90, -100, 180, 100);
  // chimney
  ctx.fillStyle = mixColor('#9c5a4a', '#2f1c16', dark * 0.7);
  ctx.fillRect(40, -150, 18, 40);
  // door
  ctx.fillStyle = mixColor('#6d4c41', '#241a16', dark * 0.7);
  ctx.fillRect(-16, -56, 32, 56);
  ctx.fillStyle = '#ffd54f';
  ctx.beginPath();
  ctx.arc(9, -28, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // windows
  for (const wx of [-70, 40]) {
    ctx.fillStyle = dark > 0.5 ? '#ffd76a' : mixColor('#bfe3f5', '#334', dark);
    ctx.fillRect(wx, -80, 30, 26);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(wx, -80, 30, 26);
    ctx.beginPath();
    ctx.moveTo(wx + 15, -80);
    ctx.lineTo(wx + 15, -54);
    ctx.moveTo(wx, -67);
    ctx.lineTo(wx + 30, -67);
    ctx.stroke();
    // flower box
    ctx.fillStyle = mixColor('#8d6e63', '#2b211e', dark * 0.7);
    ctx.fillRect(wx - 2, -54, 34, 6);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = ['#ef5350', '#ffee58', '#ab47bc', '#ef5350'][i];
      ctx.beginPath();
      ctx.arc(wx + 4 + i * 8, -56, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCoop(ctx: CanvasRenderingContext2D, dark: number): void {
  const wall = mixColor('#c98f4b', '#3d2b16', dark * 0.7);
  ctx.fillStyle = wall;
  ctx.fillRect(-50, -60, 100, 60);
  ctx.fillStyle = mixColor('#6d4c41', '#241a16', dark * 0.7);
  ctx.beginPath();
  ctx.moveTo(-58, -58);
  ctx.lineTo(0, -92);
  ctx.lineTo(58, -58);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeRect(-50, -60, 100, 60);
  // little door and ramp
  ctx.fillStyle = mixColor('#3e2723', '#150d0b', dark * 0.5);
  ctx.fillRect(-12, -34, 24, 34);
  ctx.fillStyle = mixColor('#a1887f', '#33291f', dark * 0.7);
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(12, 0);
  ctx.lineTo(30, 10);
  ctx.lineTo(-30, 10);
  ctx.closePath();
  ctx.fill();
  // wire run
  ctx.strokeStyle = 'rgba(120,120,120,0.6)';
  ctx.lineWidth = 1;
  for (let x = 50; x < 170; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, -40);
    ctx.lineTo(x, 0);
    ctx.stroke();
  }
  for (let y = -40; y <= 0; y += 10) {
    ctx.beginPath();
    ctx.moveTo(50, y);
    ctx.lineTo(170, y);
    ctx.stroke();
  }
}

function drawStable(ctx: CanvasRenderingContext2D, dark: number): void {
  const wall = mixColor('#8d6e63', '#2b211e', dark * 0.7);
  ctx.fillStyle = wall;
  ctx.fillRect(-120, -100, 240, 100);
  ctx.fillStyle = mixColor('#455a64', '#151c20', dark * 0.7);
  ctx.beginPath();
  ctx.moveTo(-132, -98);
  ctx.lineTo(0, -140);
  ctx.lineTo(132, -98);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeRect(-120, -100, 240, 100);
  for (const sx of [-90, -10, 70]) {
    ctx.fillStyle = mixColor('#3e2723', '#150d0b', dark * 0.5);
    ctx.fillRect(sx, -70, 44, 70);
    ctx.fillStyle = mixColor('#a1887f', '#33291f', dark * 0.7);
    ctx.fillRect(sx, -34, 44, 34);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.strokeRect(sx, -70, 44, 70);
    ctx.beginPath();
    ctx.moveTo(sx, -34);
    ctx.lineTo(sx + 44, -34);
    ctx.stroke();
  }
  // horseshoe sign
  ctx.strokeStyle = '#ffd54f';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -112, 9, Math.PI * 0.85, Math.PI * 2.15);
  ctx.stroke();
}

function drawShed(ctx: CanvasRenderingContext2D, dark: number): void {
  const wall = mixColor('#90a4ae', '#28323a', dark * 0.7);
  ctx.fillStyle = wall;
  ctx.fillRect(-110, -110, 220, 110);
  ctx.fillStyle = mixColor('#546e7a', '#1c262c', dark * 0.7);
  ctx.beginPath();
  ctx.moveTo(-120, -108);
  ctx.lineTo(-120, -128);
  ctx.lineTo(120, -140);
  ctx.lineTo(120, -108);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeRect(-110, -110, 220, 110);
  ctx.fillStyle = mixColor('#37474f', '#10171b', dark * 0.5);
  ctx.fillRect(-80, -90, 160, 90);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  for (let y = -84; y < 0; y += 12) {
    ctx.beginPath();
    ctx.moveTo(-80, y);
    ctx.lineTo(80, y);
    ctx.stroke();
  }
}

function drawTree(ctx: CanvasRenderingContext2D, dark: number, kind: 'oak' | 'apple' | 'willow', seed: number, time: number): void {
  const trunk = mixColor('#6d4c41', '#1f1613', dark * 0.7);
  const leaf = mixColor(kind === 'willow' ? '#7cb342' : '#4c9a3c', '#16301a', dark * 0.7);
  const sway = Math.sin(time * 0.8 + seed) * 2;
  ctx.fillStyle = trunk;
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(9, 0);
  ctx.lineTo(5, -60);
  ctx.lineTo(-5, -60);
  ctx.closePath();
  ctx.fill();
  const rng = makeRng(seed);
  if (kind === 'willow') {
    ctx.fillStyle = leaf;
    ctx.fill(blobPath(sway, -90, 52, 34, rng, 0.2, 12));
    ctx.strokeStyle = leaf;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 22; i++) {
      const x = -46 + i * 4.4;
      ctx.beginPath();
      ctx.moveTo(x + sway, -80);
      ctx.quadraticCurveTo(x + sway * 2 + 4, -40, x + sway * 2, -10 + rng() * 12);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = mixColor(leaf, '#000', 0.2);
    ctx.fill(blobPath(sway - 8, -78, 40, 30, rng, 0.25, 11));
    ctx.fillStyle = leaf;
    ctx.fill(blobPath(sway + 4, -92, 38, 30, rng, 0.25, 11));
    ctx.fill(blobPath(sway - 14, -70, 28, 22, rng, 0.25, 9));
    if (kind === 'apple') {
      ctx.fillStyle = mixColor('#e53935', '#4a0f0e', dark * 0.6);
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.arc(sway - 30 + rng() * 60, -100 + rng() * 40, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawFence(ctx: CanvasRenderingContext2D, dark: number, width: number): void {
  const wood = mixColor('#d7b98a', '#3f3626', dark * 0.7);
  ctx.fillStyle = wood;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= width; x += 40) {
    ctx.fillRect(x - 3, -30, 6, 30);
    ctx.strokeRect(x - 3, -30, 6, 30);
  }
  for (const y of [-24, -12]) {
    ctx.fillRect(0, y, width, 4);
    ctx.strokeRect(0, y, width, 4);
  }
}

function drawStoneWall(ctx: CanvasRenderingContext2D, dark: number, width: number): void {
  const rng = makeRng(31);
  for (let x = 0; x < width; x += 14) {
    for (let row = 0; row < 3; row++) {
      ctx.fillStyle = mixColor(rng() < 0.5 ? '#a8a498' : '#8f8b80', '#33312c', dark * 0.7);
      ctx.beginPath();
      ctx.ellipse(x + (row % 2) * 7, -5 - row * 8, 8, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawHayBales(ctx: CanvasRenderingContext2D, dark: number): void {
  const hay = mixColor('#e0c060', '#4d4020', dark * 0.7);
  for (const [x, y] of [
    [0, 0],
    [30, 0],
    [15, -22],
  ]) {
    ctx.fillStyle = hay;
    ctx.fillRect(x - 15, y - 22, 30, 22);
    ctx.strokeStyle = 'rgba(90,70,20,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 15, y - 22, 30, 22);
    ctx.beginPath();
    ctx.moveTo(x - 15, y - 8);
    ctx.lineTo(x + 15, y - 8);
    ctx.moveTo(x - 15, y - 15);
    ctx.lineTo(x + 15, y - 15);
    ctx.stroke();
  }
}

function drawTrough(ctx: CanvasRenderingContext2D, dark: number): void {
  ctx.fillStyle = mixColor('#8d6e63', '#2b211e', dark * 0.7);
  ctx.fillRect(-30, -16, 60, 16);
  ctx.fillStyle = mixColor('#5fa8d3', '#1c3550', dark * 0.7);
  ctx.fillRect(-26, -13, 52, 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.strokeRect(-30, -16, 60, 16);
}

function drawRock(ctx: CanvasRenderingContext2D, dark: number): void {
  ctx.fillStyle = mixColor('#9e9e9e', '#2f2f2f', dark * 0.7);
  ctx.fill(blobPath(0, -14, 34, 16, makeRng(4), 0.2, 9));
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fill(blobPath(-6, -20, 16, 6, makeRng(4), 0.2, 8));
}

function drawScarecrow(ctx: CanvasRenderingContext2D, dark: number, time: number): void {
  const wood = mixColor('#8d6e63', '#2b211e', dark * 0.7);
  ctx.fillStyle = wood;
  ctx.fillRect(-3, -80, 6, 80);
  ctx.fillRect(-30, -62, 60, 5);
  ctx.fillStyle = mixColor('#5c6bc0', '#1d2240', dark * 0.7);
  ctx.fillRect(-14, -66, 28, 34);
  ctx.fillStyle = mixColor('#e6c56a', '#4d4020', dark * 0.7);
  ctx.beginPath();
  ctx.arc(0, -78, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-18, -86, 36, 4);
  ctx.beginPath();
  ctx.moveTo(-9, -86);
  ctx.lineTo(0, -100 + Math.sin(time) * 0.5);
  ctx.lineTo(9, -86);
  ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(-4, -79, 1.5, 0, Math.PI * 2);
  ctx.arc(4, -79, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

/** Pleated prize rosette with two tails. */
export function drawRosette(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  // tails
  ctx.fillStyle = color;
  for (const dx of [-r * 0.45, r * 0.45]) {
    ctx.beginPath();
    ctx.moveTo(dx - r * 0.3, r * 0.4);
    ctx.lineTo(dx + r * 0.3, r * 0.4);
    ctx.lineTo(dx + r * 0.25, r * 1.9);
    ctx.lineTo(dx, r * 1.6);
    ctx.lineTo(dx - r * 0.25, r * 1.9);
    ctx.closePath();
    ctx.fill();
  }
  // pleats
  ctx.beginPath();
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.82;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(color, -0.25);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawShowBarn(ctx: CanvasRenderingContext2D, dark: number): void {
  // A long open-sided pole barn: roof, posts and the red valance the banners hang from.
  const w = 12 * STALLS.stallW + 40;
  const roof = mixColor('#d6d2c8', '#3f3d38', dark * 0.7);
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(-20, -150);
  ctx.lineTo(w - 20, -150);
  ctx.lineTo(w - 20, -166);
  ctx.lineTo(-20, -166);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = mixColor('#e9e6df', '#4a4843', dark * 0.7);
  ctx.fillRect(-20, -150, w, 40);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-20, -150, w, 40);
  // steel posts
  ctx.fillStyle = mixColor('#9aa0a6', '#2c2f33', dark * 0.7);
  for (let x = -12; x < w - 20; x += STALLS.stallW * 2) ctx.fillRect(x, -110, 6, 110);
  // red valance
  ctx.fillStyle = mixColor('#c62828', '#3d0d0d', dark * 0.7);
  ctx.fillRect(-20, -112, w, 34);
  ctx.strokeStyle = mixColor('#ffd54f', '#5a4a10', dark * 0.7);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-20, -80);
  ctx.lineTo(w - 20, -80);
  ctx.stroke();
  // fans hanging from the roof, like a real show barn
  for (let x = 40; x < w - 40; x += 210) {
    ctx.fillStyle = mixColor('#37474f', '#111', dark * 0.5);
    ctx.beginPath();
    ctx.arc(x, -128, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x, -128);
      ctx.lineTo(x + Math.cos(a) * 10, -128 + Math.sin(a) * 10);
      ctx.stroke();
    }
  }
}

function drawRingBackdrop(ctx: CanvasRenderingContext2D, dark: number): void {
  // Judge's table under a big fair banner with hanging flower baskets.
  const w = RING.x1 - RING.x0;
  ctx.fillStyle = mixColor('#283593', '#0f1440', dark * 0.7);
  ctx.fillRect(40, -150, w - 80, 70);
  ctx.strokeStyle = mixColor('#ffd54f', '#5a4a10', dark * 0.7);
  ctx.lineWidth = 3;
  ctx.strokeRect(40, -150, w - 80, 70);
  ctx.fillStyle = '#ffd54f';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('THE FARM FAIR', w / 2, -122);
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('COW SHOW', w / 2, -96);
  // poles
  ctx.fillStyle = mixColor('#9aa0a6', '#2c2f33', dark * 0.7);
  ctx.fillRect(40, -150, 5, 150);
  ctx.fillRect(w - 45, -150, 5, 150);
  // table with skirt
  ctx.fillStyle = mixColor('#f5f5f5', '#4a4a4a', dark * 0.7);
  ctx.fillRect(w / 2 - 90, -56, 180, 52);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(w / 2 - 90, -56, 180, 52);
  ctx.fillStyle = mixColor('#e0e0e0', '#3a3a3a', dark * 0.7);
  ctx.fillRect(w / 2 - 94, -60, 188, 6);
  // flower baskets
  for (const bx of [w / 2 - 120, w / 2 + 120]) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, -150);
    ctx.lineTo(bx, -100);
    ctx.stroke();
    ctx.fillStyle = mixColor('#4c9a3c', '#16301a', dark * 0.7);
    ctx.fill(blobPath(bx, -86, 22, 14, makeRng(Math.round(bx)), 0.3, 10));
    const rng = makeRng(Math.round(bx) + 3);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = ['#ef5350', '#f48fb1', '#ffee58', '#ffa726'][i % 4];
      ctx.beginPath();
      ctx.arc(bx - 18 + rng() * 36, -92 + rng() * 16, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // water bottles on the table
  ctx.fillStyle = 'rgba(120,190,240,0.8)';
  for (const bx of [w / 2 - 60, w / 2 + 50]) ctx.fillRect(bx, -70, 5, 14);
}

function drawRingRail(ctx: CanvasRenderingContext2D, dark: number, width: number, front: boolean): void {
  // White pipe panels around the ring.
  const pipe = mixColor('#f5f5f5', '#4a4a4a', dark * 0.7);
  ctx.strokeStyle = pipe;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.5;
  for (const y of front ? [-14, -26] : [-16, -30]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let x = 0; x <= width; x += 46) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, front ? -30 : -34);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  for (const y of front ? [-12.5, -24.5] : [-14.5, -28.5]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawBleachers(ctx: CanvasRenderingContext2D, dark: number): void {
  const wood = mixColor('#a1887f', '#33291f', dark * 0.7);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = i % 2 ? wood : shade(wood, -0.1);
    ctx.fillRect(-70, -20 - i * 16, 140, 10);
    ctx.fillStyle = mixColor('#78909c', '#222', dark * 0.7);
    ctx.fillRect(-70, -10 - i * 16, 140, 6);
  }
  // a few spectators
  const rng = makeRng(8);
  for (let i = 0; i < 9; i++) {
    const x = -60 + rng() * 120;
    const row = Math.floor(rng() * 4);
    const y = -26 - row * 16;
    ctx.fillStyle = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa'][i % 5];
    ctx.fillRect(x - 5, y - 10, 10, 12);
    ctx.fillStyle = ['#f1c9a5', '#8d5a3a', '#e8b48d'][i % 3];
    ctx.beginPath();
    ctx.arc(x, y - 15, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function buildProps(): Prop[] {
  const back = GROUND_TOP + 6;
  const props: Prop[] = [
    { x: 300, y: back, w: 110, draw: (c, d) => drawHouse(c, d) },
    { x: 120, y: back + 2, w: 60, draw: (c, d, t) => drawTree(c, d, 'oak', 1, t) },
    { x: 470, y: back + 4, w: 60, draw: (c, d, t) => drawTree(c, d, 'apple', 2, t) },
    { x: 560, y: back + 1, w: 640, draw: (c, d) => drawFence(c, d, 1260) },
    { x: 820, y: back, w: 130, draw: (c, d) => drawBarn(c, d) },
    { x: 1000, y: back - 1, w: 30, draw: (c, d) => drawSilo(c, d) },
    { x: 1380, y: back + 40, w: 40, draw: (c, d) => drawHayBales(c, d) },
    { x: 1640, y: back + 70, w: 30, draw: (c, d) => drawTrough(c, d) },
    { x: 1720, y: back + 2, w: 60, draw: (c, d, t) => drawTree(c, d, 'oak', 7, t) },
    { x: 1890, y: back + 6, w: 60, draw: (c, d, t) => drawTree(c, d, 'willow', 3, t) },
    { x: 2290, y: back + 2, w: 60, draw: (c, d, t) => drawTree(c, d, 'oak', 4, t) },
    { x: 2450, y: back, w: 120, draw: (c, d) => drawCoop(c, d) },
    { x: 2680, y: back + 1, w: 140, draw: (c, d) => drawFence(c, d, 260) },
    { x: 2960, y: back + 1, w: 260, draw: (c, d) => drawStoneWall(c, d, 520) },
    { x: 3300, y: back + 50, w: 40, draw: (c, d) => drawRock(c, d) },
    { x: 3500, y: back + 1, w: 320, draw: (c, d) => drawFence(c, d, 630) },
    { x: 3800, y: back, w: 130, draw: (c, d) => drawStable(c, d) },
    { x: 4280, y: back, w: 120, draw: (c, d) => drawShed(c, d) },
    { x: 4520, y: back + 4, w: 30, draw: (c, d, t) => drawScarecrow(c, d, t) },
    { x: 4700, y: back + 2, w: 60, draw: (c, d, t) => drawTree(c, d, 'apple', 5, t) },
    { x: 4800, y: back + 8, w: 60, draw: (c, d, t) => drawTree(c, d, 'apple', 6, t) },
    // The fair: show barn with stall banners, then the show ring.
    { x: STALLS.x0 - 20, y: back - 2, w: 460, draw: (c, d) => drawShowBarn(c, d) },
    { x: 5780, y: back + 30, w: 80, draw: (c, d) => drawBleachers(c, d) },
    { x: RING.x0, y: back - 1, w: 240, draw: (c, d) => drawRingBackdrop(c, d) },
    { x: RING.x0, y: RING.y0 + 2, w: 240, draw: (c, d) => drawRingRail(c, d, RING.x1 - RING.x0, false) },
    { x: RING.x0, y: RING.y1 + 16, w: 240, draw: (c, d) => drawRingRail(c, d, RING.x1 - RING.x0, true) },
    { x: 6360, y: back + 2, w: 60, draw: (c, d, t) => drawTree(c, d, 'oak', 9, t) },
  ];
  return props;
}

/** Sign post for each area, drawn at the front of the ground band. */
export function drawSign(ctx: CanvasRenderingContext2D, label: string, dark: number): void {
  const wood = mixColor('#a1887f', '#33291f', dark * 0.7);
  ctx.fillStyle = wood;
  ctx.fillRect(-2.5, -34, 5, 34);
  const w = Math.max(70, label.length * 7 + 16);
  ctx.fillStyle = mixColor('#efdcb0', '#4a4232', dark * 0.7);
  ctx.fill(roundRectPath(-w / 2, -50, w, 20, 5));
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.2;
  ctx.stroke(roundRectPath(-w / 2, -50, w, 20, 5));
  ctx.fillStyle = mixColor('#4e342e', '#d7ccc8', dark * 0.8);
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, -40);
}

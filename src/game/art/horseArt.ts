/** Side-view horse renderer: high withers, arched neck, long legs, flowing mane and tail. */
import type { HorseBreed } from '../breeds/otherBreeds';
import { blobPath, cubicPoint, lerp, makeRng, shade, type Vec } from '../util';
import { darkenPart, drawEye, drawTufts, paintPart, strokePart, type Fill, type Pose } from './common';

interface HorseMarkings {
  body: Fill[];
  head: Fill[];
}
const cache = new Map<string, HorseMarkings>();

function markings(b: HorseBreed, seed: number): HorseMarkings {
  const key = `${b.id}:${seed}`;
  const c = cache.get(key);
  if (c) return c;
  const rng = makeRng(seed ^ 0x51ed);
  const body: Fill[] = [];
  const head: Fill[] = [];
  if (b.spots) {
    for (let i = 0; i < 60; i++) {
      const x = lerp(-70, 60, rng());
      const y = lerp(-90, -30, rng());
      const r = 1.5 + rng() * 3.5;
      body.push({ path: blobPath(x, y, r * 1.3, r, rng, 0.3, 7), color: b.spots });
    }
  }
  if (b.patches) {
    const anchors = [
      [-50, -60, 22, 26],
      [20, -46, 26, 22],
      [-10, -80, 18, 12],
    ];
    for (const [x, y, rx, ry] of anchors) {
      body.push({
        path: blobPath(x + (rng() - 0.5) * 16, y + (rng() - 0.5) * 12, rx * (0.8 + rng() * 0.4), ry * (0.8 + rng() * 0.4), rng, 0.45, 10),
        color: b.patches,
      });
    }
  }
  if (b.blaze === 'blaze') {
    const p = new Path2D();
    p.moveTo(-1, -12);
    p.quadraticCurveTo(14, -12, 30, -4);
    p.lineTo(36, 4);
    p.lineTo(31, 2);
    p.quadraticCurveTo(14, -5, 2, -7);
    p.closePath();
    head.push({ path: p, color: '#f6f2ea' });
  } else if (b.blaze === 'star') {
    head.push({ path: blobPath(6, -8, 3.2, 2.6, rng, 0.4, 7), color: '#f6f2ea' });
  }
  const m = { body, head };
  cache.set(key, m);
  return m;
}

function legPath(kind: 'front' | 'hind', heavy: boolean, bend: number): Path2D {
  const w = heavy ? 7 : 5.5;
  const p = new Path2D();
  if (kind === 'front') {
    p.moveTo(-w * 1.3, -66);
    p.quadraticCurveTo(w * 1.5, -68, w * 1.1, -40);
    p.lineTo(w * 0.7 + bend, -30);
    p.lineTo(w * 0.55 + bend * 1.8, -2);
    p.lineTo(-w * 0.55 + bend * 1.8, -2);
    p.lineTo(-w * 0.6 + bend, -30);
    p.lineTo(-w * 1.1, -44);
    p.closePath();
  } else {
    p.moveTo(-w * 2.6, -70);
    p.quadraticCurveTo(w * 1.8, -72, w * 1.9, -48);
    p.quadraticCurveTo(w * 1.3, -36, w * 0.6 - bend, -28);
    p.lineTo(w * 0.55 - bend * 1.8, -2);
    p.lineTo(-w * 0.55 - bend * 1.8, -2);
    p.lineTo(-w * 0.9 - bend, -28);
    p.quadraticCurveTo(-w * 2.4, -40, -w * 2.6, -58);
    p.closePath();
  }
  return p;
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  kind: 'front' | 'hind',
  x: number,
  pivotY: number,
  swing: number,
  b: HorseBreed,
  m: HorseMarkings,
  near: boolean,
  t: number,
): void {
  ctx.save();
  ctx.translate(x, pivotY);
  ctx.rotate(swing);
  ctx.translate(0, -pivotY);
  const bend = Math.max(0, kind === 'front' ? -swing : swing) * 12;
  const path = legPath(kind, !!b.heavy, bend);
  const socks: Fill[] = [];
  if (b.socks) {
    const p = new Path2D();
    p.rect(-60, -22, 120, 40);
    socks.push({ path: p, color: '#f6f2ea' });
  }
  paintPart(ctx, path, b.coat, [...m.body, ...socks], [-80, 0], near ? 1 : 0.5);
  if (!near) darkenPart(ctx, path);
  strokePart(ctx, path, 1.1, near ? 0.32 : 0.2);
  // Hoof
  const hw = b.heavy ? 6.5 : 5;
  ctx.fillStyle = near ? b.hoof : shade(b.hoof, -0.3);
  ctx.beginPath();
  ctx.moveTo(-hw + bend * 1.8, -6);
  ctx.lineTo(hw + bend * 1.8, -6);
  ctx.lineTo(hw + 1.2 + bend * 1.8, 0);
  ctx.lineTo(-hw - 1.2 + bend * 1.8, 0);
  ctx.closePath();
  ctx.fill();
  if (b.feathers) {
    const rng = makeRng(kind === 'front' ? 5 : 9);
    const pts: Vec[] = [];
    for (let i = 0; i < 9; i++) pts.push({ x: -hw - 2 + (i / 8) * (hw * 2 + 4) + bend * 1.8, y: -14 + rng() * 4 });
    drawTufts(ctx, pts, b.socks ? '#f3eee4' : b.coat, 12, rng, t);
  }
  ctx.restore();
}

export function drawHorse(ctx: CanvasRenderingContext2D, b: HorseBreed, seed: number, pose: Pose): void {
  const m = markings(b, seed);
  ctx.save();
  ctx.scale(b.size, b.size);
  const heavy = b.heavy ? 1.12 : 1;
  const bob = Math.sin(pose.walk * 2) * 1.5 * pose.moving;
  // Rear (jump): lift the front when action is high.
  const rear = pose.action;
  ctx.translate(0, bob);
  if (rear > 0.01) {
    ctx.translate(-40, 0);
    ctx.rotate(-rear * 0.5);
    ctx.translate(40, 0);
  }

  const amp = 0.38 * pose.moving;
  const sw = (ph: number) => Math.sin(pose.walk + ph) * amp - rear * 0.5;

  // Body
  const withers: Vec = { x: 26, y: -86 };
  const body = new Path2D();
  body.moveTo(withers.x, withers.y);
  body.bezierCurveTo(10, -84, -20, -80, -44, -84); // back with a gentle dip
  body.bezierCurveTo(-58, -86, -66, -80, -66, -74); // croup to dock
  body.bezierCurveTo(-74 * heavy, -62, -72 * heavy, -50, -60, -44); // rounded hindquarters
  body.bezierCurveTo(-50, -38, -30, -36, -8, -40); // flank to belly
  body.bezierCurveTo(12, -42, 34, -44, 48, -52); // girth to chest
  body.bezierCurveTo(60, -60, 58, -74, 44, -82); // chest up to shoulder
  body.bezierCurveTo(38, -86, 30, -88, withers.x, withers.y);
  body.closePath();

  // Neck: arched, attaches high.
  const hd = pose.headDown;
  const j: Vec = { x: lerp(74, 92, hd), y: lerp(-108, -46, hd) };
  const ang = lerp(0.65, 1.35, hd) - rear * 0.3;
  const neck = new Path2D();
  const nt = 12 * heavy;
  const jTop = { x: j.x - Math.sin(ang) * nt, y: j.y - Math.cos(ang) * nt };
  const jBot = { x: j.x + Math.sin(ang) * nt * 0.9, y: j.y + Math.cos(ang) * nt * 0.9 };
  neck.moveTo(20, -84);
  neck.quadraticCurveTo(lerp(50, 50, hd), lerp(-112, -84, hd), jTop.x, jTop.y);
  neck.lineTo(jBot.x, jBot.y);
  neck.quadraticCurveTo(lerp(70, 76, hd), lerp(-62, -50, hd), 46, -54);
  neck.lineTo(32, -70);
  neck.closePath();

  // Far legs
  drawLeg(ctx, 'hind', -40 + 7, -66, sw(Math.PI + 0.4), b, m, false, pose.t);
  drawLeg(ctx, 'front', 28 + 7, -66, sw(Math.PI), b, m, false, pose.t);

  // Tail: long flowing hair from the dock.
  {
    const rng = makeRng(seed);
    const swish = pose.tail * 8 + Math.sin(pose.t * 1.1) * 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      const c = i % 3 === 0 ? shade(b.mane, 0.15) : i % 3 === 1 ? shade(b.mane, -0.15) : b.mane;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2 + rng() * 1.5;
      const x0 = -66 + rng() * 4;
      const y0 = -74 + rng() * 6;
      const len = 44 + rng() * 14;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 - 8 + swish * 0.5 + rng() * 4, y0 + len * 0.5, x0 - 6 + swish + (rng() - 0.5) * 10, y0 + len);
      ctx.stroke();
    }
  }

  paintPart(ctx, body, b.coat, m.body, [-90, -36]);
  paintPart(ctx, neck, b.coat, m.body, [-120, -50]);
  strokePart(ctx, body);
  strokePart(ctx, neck, 1.1);

  // Near legs
  drawLeg(ctx, 'hind', -40, -66, sw(0.4), b, m, true, pose.t);
  drawLeg(ctx, 'front', 28, -66, sw(0), b, m, true, pose.t);

  // Mane along the neck crest, on the near side.
  {
    const rng = makeRng(seed + 3);
    const p0 = { x: 20, y: -84 };
    const p1 = { x: lerp(50, 50, hd), y: lerp(-112, -84, hd) };
    const p3 = jTop;
    for (let i = 0; i < 18; i++) {
      const tt = i / 17;
      const pt = cubicPoint(p0, p1, p1, p3, tt);
      const c = i % 3 === 0 ? shade(b.mane, 0.18) : i % 3 === 1 ? shade(b.mane, -0.18) : b.mane;
      ctx.strokeStyle = c;
      ctx.lineWidth = 2.4 + rng();
      ctx.lineCap = 'round';
      const len = 16 + rng() * 10;
      const sway = Math.sin(pose.t * 2 + i) * 1.5;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.quadraticCurveTo(pt.x - 6 + sway, pt.y + len * 0.5, pt.x - 4 + sway + (rng() - 0.5) * 6, pt.y + len);
      ctx.stroke();
    }
  }

  // Head
  ctx.save();
  ctx.translate(j.x, j.y);
  ctx.rotate(ang);
  const head = new Path2D();
  head.moveTo(-6, -11);
  head.quadraticCurveTo(8, -13, 16, -9);
  head.quadraticCurveTo(28, -5, 36, 0);
  head.quadraticCurveTo(41, 4, 39, 9);
  head.quadraticCurveTo(36, 13, 30, 13);
  head.quadraticCurveTo(16, 14, 4, 12);
  head.quadraticCurveTo(-8, 10, -10, 2);
  head.quadraticCurveTo(-11, -6, -6, -11);
  head.closePath();
  // Far ear
  const earFlick = pose.ear * 0.4;
  const drawEar = (near: boolean) => {
    ctx.save();
    ctx.translate(-2, -10);
    ctx.rotate((near ? -0.35 : -0.75) + earFlick);
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.quadraticCurveTo(-1, -12, 1, -14);
    ctx.quadraticCurveTo(4, -10, 3.5, 0);
    ctx.closePath();
    ctx.fillStyle = near ? b.coat : shade(b.coat, -0.3);
    ctx.fill();
    strokePart(ctx, new Path2D(), 0);
    ctx.strokeStyle = 'rgba(30,20,15,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    if (near) {
      ctx.beginPath();
      ctx.moveTo(-1.5, -1);
      ctx.quadraticCurveTo(0, -9, 1, -11);
      ctx.quadraticCurveTo(2, -7, 2, -1);
      ctx.fillStyle = 'rgba(230,170,160,0.7)';
      ctx.fill();
    }
    ctx.restore();
  };
  drawEar(false);
  paintPart(ctx, head, b.coat, m.head, [-14, 14]);
  // muzzle + nostril + mouth
  ctx.fillStyle = b.muzzle;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(35, 7, 5.5, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = shade(b.muzzle, -0.4);
  ctx.beginPath();
  ctx.ellipse(35.5, 3, 2, 1.4, -0.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,5,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(37, 10 + pose.chew);
  ctx.quadraticCurveTo(32, 11.5 + pose.chew * 1.5, 27, 10);
  ctx.stroke();
  strokePart(ctx, head);
  drawEye(ctx, 9, -3, 3, '#1a120c', pose.blink, false);
  drawEar(true);
  // forelock
  {
    const rng = makeRng(seed + 11);
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      ctx.strokeStyle = i % 2 ? shade(b.mane, 0.15) : b.mane;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(-3 + rng() * 4, -11);
      ctx.quadraticCurveTo(4 + rng() * 4, -9, 6 + rng() * 7, -3 + rng() * 3);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.restore();
}

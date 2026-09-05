/** Pigs, sheep and goats. */
import type { GoatBreed, PigBreed, SheepBreed } from '../breeds/otherBreeds';
import { blobPath, makeRng, shade, type Vec } from '../util';
import { darkenPart, drawEye, drawTufts, paintPart, strokePart, type Fill, type Pose } from './common';

const pigCache = new Map<string, Fill[]>();

function pigMarkings(b: PigBreed, seed: number): Fill[] {
  const key = `${b.id}:${seed}`;
  const c = pigCache.get(key);
  if (c) return c;
  const rng = makeRng(seed ^ 0x919);
  const fills: Fill[] = [];
  if (b.pattern === 'spots' && b.marking) {
    for (let i = 0; i < 6; i++) {
      fills.push({
        path: blobPath(-36 + rng() * 76, -34 + rng() * 22, 4 + rng() * 6, 3 + rng() * 5, rng, 0.45, 8),
        color: b.marking,
      });
    }
  }
  if (b.pattern === 'saddle' && b.marking) {
    const p = new Path2D();
    const x0 = 4 + (rng() - 0.5) * 6;
    p.rect(x0, -60, 18 + rng() * 6, 80);
    fills.push({ path: p, color: b.marking });
  }
  pigCache.set(key, fills);
  return fills;
}

export function drawPig(ctx: CanvasRenderingContext2D, b: PigBreed, seed: number, pose: Pose): void {
  const m = pigMarkings(b, seed);
  ctx.save();
  ctx.scale(b.size, b.size);
  ctx.translate(0, Math.sin(pose.walk * 2) * 1 * pose.moving);
  const amp = 0.4 * pose.moving;
  const sw = (ph: number) => Math.sin(pose.walk + ph) * amp;
  const white = b.marking ?? '#f5efe6';

  const leg = (x: number, swing: number, near: boolean) => {
    ctx.save();
    ctx.translate(x, -20);
    ctx.rotate(swing);
    ctx.translate(0, 20);
    const p = new Path2D();
    p.moveTo(-5, -22);
    p.lineTo(5, -22);
    p.lineTo(4, -2);
    p.lineTo(-4, -2);
    p.closePath();
    const fills = [...m];
    if (b.pattern === 'points') {
      const s = new Path2D();
      s.rect(-10, -8, 20, 10);
      fills.push({ path: s, color: white });
    }
    paintPart(ctx, p, b.skin, fills, [-24, 0], near ? 1 : 0.5);
    if (!near) darkenPart(ctx, p);
    strokePart(ctx, p, 1, near ? 0.3 : 0.2);
    ctx.fillStyle = '#4a3a34';
    ctx.fillRect(-4.5, -4, 9, 4);
    ctx.restore();
  };
  leg(-22 + 4, sw(Math.PI + 0.4), false);
  leg(18 + 4, sw(Math.PI), false);

  // Body: long rounded barrel, low to the ground.
  const body = new Path2D();
  body.moveTo(24, -42);
  body.bezierCurveTo(6, -46, -20, -46, -34, -40);
  body.bezierCurveTo(-46, -34, -46, -18, -34, -14);
  body.bezierCurveTo(-16, -10, 10, -10, 26, -14);
  body.bezierCurveTo(40, -18, 40, -36, 24, -42);
  body.closePath();
  paintPart(ctx, body, b.skin, m, [-46, -12]);
  strokePart(ctx, body, 1.1);

  // Curly tail
  ctx.strokeStyle = b.pattern === 'points' ? white : shade(b.skin, -0.15);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const wig = Math.sin(pose.t * 6) * 1.5 * (0.3 + pose.action);
  ctx.moveTo(-42, -36);
  ctx.bezierCurveTo(-50 + wig, -44, -54, -34, -47 + wig, -34);
  ctx.bezierCurveTo(-52, -30, -46, -26, -49 + wig, -28);
  ctx.stroke();

  leg(-22, sw(0.4), true);
  leg(18, sw(0), true);

  // Head with snout
  const hd = pose.headDown;
  ctx.save();
  ctx.translate(30 + hd * 4, -34 + hd * 14);
  ctx.rotate(0.15 + hd * 0.7);
  const head = new Path2D();
  head.moveTo(-8, -12);
  head.quadraticCurveTo(8, -16, 16, -8);
  head.quadraticCurveTo(24, -2, 26, 2);
  head.quadraticCurveTo(26, 8, 22, 10);
  head.quadraticCurveTo(10, 14, -4, 12);
  head.quadraticCurveTo(-12, 8, -12, 0);
  head.quadraticCurveTo(-12, -8, -8, -12);
  head.closePath();
  const headFills: Fill[] = [];
  if (b.pattern === 'points') {
    const s = new Path2D();
    s.rect(18, -6, 12, 20);
    headFills.push({ path: s, color: white });
  }
  if (b.pattern === 'spots' && b.marking) headFills.push({ path: blobPath(4, -4, 5, 4, makeRng(seed), 0.4, 7), color: b.marking });
  // far ear
  const ear = (near: boolean) => {
    ctx.save();
    ctx.translate(-2, -10);
    const p = new Path2D();
    if (b.ears === 'up') {
      ctx.rotate((near ? -0.1 : -0.5) + pose.ear * 0.3);
      p.moveTo(-5, 2);
      p.quadraticCurveTo(-3, -12, 2, -14);
      p.quadraticCurveTo(7, -8, 6, 2);
      p.closePath();
    } else {
      ctx.rotate((near ? 0.5 : 0.2) + pose.ear * 0.3);
      p.moveTo(-5, -2);
      p.quadraticCurveTo(2, -10, 10, -6);
      p.quadraticCurveTo(14, 2, 8, 8);
      p.quadraticCurveTo(0, 8, -5, 2);
      p.closePath();
    }
    ctx.fillStyle = near ? b.skin : shade(b.skin, -0.3);
    ctx.fill(p);
    strokePart(ctx, p, 1, 0.35);
    if (near) {
      ctx.fillStyle = 'rgba(200,120,110,0.5)';
      ctx.save();
      ctx.scale(0.6, 0.6);
      ctx.fill(p);
      ctx.restore();
    }
    ctx.restore();
  };
  ear(false);
  paintPart(ctx, head, b.skin, headFills, [-16, 14]);
  strokePart(ctx, head, 1.1);
  // snout disc
  ctx.fillStyle = b.pattern === 'points' ? '#f0d9cf' : shade(b.skin, -0.12);
  ctx.beginPath();
  ctx.ellipse(25, 4, 3.5, 5.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,40,40,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(80,40,40,0.7)';
  for (const dy of [-1.8, 1.8]) {
    ctx.beginPath();
    ctx.ellipse(25.5, 4 + dy, 1, 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  drawEye(ctx, 8, -3, 2.2, '#2a1d14', pose.blink, true);
  ear(true);
  ctx.restore();
  ctx.restore();
}

export function drawSheep(ctx: CanvasRenderingContext2D, b: SheepBreed, seed: number, pose: Pose): void {
  ctx.save();
  ctx.scale(b.size, b.size);
  ctx.translate(0, Math.sin(pose.walk * 2) * 1 * pose.moving - pose.action * 8);
  const amp = 0.4 * pose.moving;
  const sw = (ph: number) => Math.sin(pose.walk + ph) * amp;
  const rng = makeRng(seed);

  const leg = (x: number, swing: number, near: boolean) => {
    ctx.save();
    ctx.translate(x, -26);
    ctx.rotate(swing);
    ctx.translate(0, 26);
    const p = new Path2D();
    p.moveTo(-3.5, -30);
    p.lineTo(3.5, -30);
    p.lineTo(3, -2);
    p.lineTo(-3, -2);
    p.closePath();
    paintPart(ctx, p, b.legs, [], [-30, 0], near ? 1 : 0.5);
    if (!near) darkenPart(ctx, p);
    strokePart(ctx, p, 0.9, 0.3);
    ctx.fillStyle = '#2a2220';
    ctx.fillRect(-3.5, -4, 7, 4);
    ctx.restore();
  };
  leg(-18 + 4, sw(Math.PI + 0.4), false);
  leg(16 + 4, sw(Math.PI), false);

  // Wool: a cloud of overlapping blobs.
  const wool = new Path2D();
  wool.moveTo(28, -44);
  const pts: Vec[] = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: -4 + Math.cos(a) * 36, y: -34 + Math.sin(a) * 20 });
  }
  wool.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const nx = mx + (mx + 4) * 0.12;
    const ny = my + (my + 34) * 0.16;
    wool.quadraticCurveTo(nx, ny, p2.x, p2.y);
  }
  wool.closePath();
  const woolFills: Fill[] = [];
  if (b.id === 'jacob') {
    for (let i = 0; i < 5; i++) {
      woolFills.push({ path: blobPath(-30 + rng() * 60, -44 + rng() * 22, 6 + rng() * 6, 5 + rng() * 5, rng, 0.4, 8), color: '#2a2424' });
    }
  }
  paintPart(ctx, wool, b.wool, woolFills, [-56, -14]);
  // inner fluff detail
  ctx.strokeStyle = 'rgba(120,110,95,0.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(-30 + rng() * 56, -44 + rng() * 22, 4 + rng() * 4, Math.PI * 0.2, Math.PI * 1.1);
    ctx.stroke();
  }
  strokePart(ctx, wool, 1.1, 0.35);

  leg(-18, sw(0.4), true);
  leg(16, sw(0), true);

  // Head
  const hd = pose.headDown;
  ctx.save();
  ctx.translate(28 + hd * 6, -40 + hd * 22);
  ctx.rotate(0.35 + hd * 0.7);
  const head = new Path2D();
  head.moveTo(-8, -9);
  head.quadraticCurveTo(4, -12, 12, -8);
  head.quadraticCurveTo(20, -4, 22, 2);
  head.quadraticCurveTo(22, 8, 16, 9);
  head.quadraticCurveTo(6, 11, -4, 9);
  head.quadraticCurveTo(-10, 5, -10, 0);
  head.quadraticCurveTo(-10, -6, -8, -9);
  head.closePath();
  const ear = (near: boolean) => {
    ctx.save();
    ctx.translate(-4, -5);
    ctx.rotate((near ? 0.25 : -0.1) + pose.ear * 0.3);
    ctx.beginPath();
    ctx.ellipse(-7, 1, 8, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = near ? b.face : shade(b.face, -0.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,15,0.35)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  };
  ear(false);
  if (b.horns) {
    ctx.strokeStyle = '#8a7a62';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, -8);
    ctx.quadraticCurveTo(-12, -18, -2, -22);
    ctx.stroke();
  }
  paintPart(ctx, head, b.face, [], [-12, 10]);
  // wool top-knot
  ctx.fillStyle = b.wool;
  ctx.beginPath();
  ctx.ellipse(-2, -9, 8, 4.5, 0.2, 0, Math.PI * 2);
  ctx.fill();
  strokePart(ctx, head, 1, 0.4);
  ctx.fillStyle = shade(b.face, -0.35);
  ctx.beginPath();
  ctx.ellipse(21, 3, 1.6, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(20, 6 + pose.chew);
  ctx.quadraticCurveTo(16, 8 + pose.chew, 12, 6);
  ctx.stroke();
  drawEye(ctx, 6, -2, 2.2, '#c9a463', pose.blink);
  ear(true);
  ctx.restore();
  ctx.restore();
}

export function drawGoat(ctx: CanvasRenderingContext2D, b: GoatBreed, seed: number, pose: Pose): void {
  ctx.save();
  ctx.scale(b.size, b.size);
  ctx.translate(0, Math.sin(pose.walk * 2) * 1 * pose.moving - pose.action * 14);
  const amp = 0.42 * pose.moving;
  const sw = (ph: number) => Math.sin(pose.walk + ph) * amp;
  const rng = makeRng(seed);
  const fills: Fill[] = [];
  if (b.marking) {
    if (b.id === 'alpine') {
      const p = new Path2D();
      p.rect(10, -70, 50, 80);
      fills.push({ path: p, color: b.marking });
    } else {
      for (let i = 0; i < 4; i++)
        fills.push({ path: blobPath(-30 + rng() * 50, -38 + rng() * 16, 6 + rng() * 5, 5 + rng() * 4, rng, 0.4, 8), color: b.marking });
    }
  }

  const leg = (x: number, swing: number, near: boolean) => {
    ctx.save();
    ctx.translate(x, -30);
    ctx.rotate(swing);
    ctx.translate(0, 30);
    const p = new Path2D();
    p.moveTo(-4, -34);
    p.lineTo(4.5, -34);
    p.lineTo(3, -2);
    p.lineTo(-3, -2);
    p.closePath();
    paintPart(ctx, p, b.coat, fills, [-34, 0], near ? 1 : 0.5);
    if (!near) darkenPart(ctx, p);
    strokePart(ctx, p, 0.9, 0.3);
    ctx.fillStyle = '#2a2220';
    ctx.fillRect(-3.5, -4, 7, 4);
    ctx.restore();
  };
  leg(-20 + 4, sw(Math.PI + 0.4), false);
  leg(16 + 4, sw(Math.PI), false);

  const body = new Path2D();
  body.moveTo(22, -50);
  body.bezierCurveTo(6, -52, -20, -52, -32, -48);
  body.bezierCurveTo(-40, -44, -40, -30, -30, -26);
  body.bezierCurveTo(-14, -22, 6, -24, 22, -28);
  body.bezierCurveTo(32, -32, 32, -46, 22, -50);
  body.closePath();
  paintPart(ctx, body, b.coat, fills, [-52, -24]);
  strokePart(ctx, body, 1.1);
  // stubby upright tail
  ctx.fillStyle = b.coat;
  ctx.beginPath();
  ctx.moveTo(-32, -46);
  ctx.quadraticCurveTo(-40, -56 + Math.sin(pose.t * 8) * 2, -34, -60);
  ctx.quadraticCurveTo(-30, -54, -28, -48);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,20,15,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  leg(-20, sw(0.4), true);
  leg(16, sw(0), true);

  // Neck + head
  const hd = pose.headDown;
  const neck = new Path2D();
  neck.moveTo(14, -50);
  neck.quadraticCurveTo(24, -62 + hd * 20, 30 + hd * 6, -66 + hd * 34);
  neck.lineTo(38 + hd * 6, -58 + hd * 34);
  neck.quadraticCurveTo(32, -40, 24, -32);
  neck.closePath();
  paintPart(ctx, neck, b.coat, fills, [-70, -30]);
  strokePart(ctx, neck, 1, 0.3);
  ctx.save();
  ctx.translate(34 + hd * 6, -62 + hd * 34);
  ctx.rotate(0.35 + hd * 0.8);
  const head = new Path2D();
  head.moveTo(-8, -8);
  head.quadraticCurveTo(4, -11, 12, -7);
  head.quadraticCurveTo(20, -2, 22, 3); // slight roman nose
  head.quadraticCurveTo(21, 8, 15, 9);
  head.quadraticCurveTo(4, 10, -4, 8);
  head.quadraticCurveTo(-10, 5, -10, 0);
  head.quadraticCurveTo(-10, -5, -8, -8);
  head.closePath();
  // horns sweep back
  for (const near of [false, true]) {
    ctx.strokeStyle = near ? '#8a7a62' : '#6a5a44';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, -7);
    ctx.quadraticCurveTo(-8 + (near ? 2 : -2), -18, -16 + (near ? 2 : -4), -22);
    ctx.stroke();
  }
  const ear = (near: boolean) => {
    ctx.save();
    ctx.translate(-4, -4);
    ctx.rotate((near ? 0.2 : -0.1) + pose.ear * 0.3);
    ctx.beginPath();
    if (b.ears === 'long') ctx.ellipse(-4, 8, 3.6, 12, 0.3, 0, Math.PI * 2);
    else ctx.ellipse(-7, 0, 8, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = near ? b.coat : shade(b.coat, -0.3);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,15,0.35)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    ctx.restore();
  };
  ear(false);
  const headFills: Fill[] = [];
  if (b.id === 'alpine' && b.marking) {
    const p = new Path2D();
    p.moveTo(-2, -10);
    p.quadraticCurveTo(10, -8, 22, 2);
    p.lineTo(18, 12);
    p.lineTo(6, 12);
    p.quadraticCurveTo(4, 0, -2, -4);
    p.closePath();
    headFills.push({ path: p, color: b.marking });
  }
  paintPart(ctx, head, b.coat, headFills, [-12, 10]);
  strokePart(ctx, head, 1, 0.4);
  if (b.beard) {
    const pts: Vec[] = [];
    for (let i = 0; i < 5; i++) pts.push({ x: 10 + i * 2, y: 8 });
    drawTufts(ctx, pts, shade(b.coat, -0.1), 8, rng, pose.t);
  }
  ctx.fillStyle = shade(b.coat, -0.4);
  ctx.beginPath();
  ctx.ellipse(21, 3, 1.6, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(20, 6 + pose.chew);
  ctx.quadraticCurveTo(16, 8 + pose.chew, 12, 6);
  ctx.stroke();
  // goats have horizontal pupils
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(6, -2, 2.8, 2.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#d9b26a';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#1a120c';
  ctx.fillRect(3, -2.8, 6, 1.8 * (1 - pose.blink));
  ctx.restore();
  ctx.strokeStyle = 'rgba(30,20,15,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(6, -2, 2.8, 2.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ear(true);
  ctx.restore();
  ctx.restore();
}

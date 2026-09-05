/** Side-view dog renderer with breed coat patterns, fluffy coats and a wagging tail. */
import type { DogBreed } from '../breeds/otherBreeds';
import { blobPath, makeRng, shade, type Vec } from '../util';
import { darkenPart, drawEye, drawTufts, paintPart, strokePart, type Fill, type Pose } from './common';

interface DogMarkings {
  body: Fill[];
  head: Fill[];
  legWhite: boolean;
  tailTipWhite: boolean;
}
const cache = new Map<string, DogMarkings>();

function markings(b: DogBreed, seed: number): DogMarkings {
  const key = `${b.id}:${seed}`;
  const c = cache.get(key);
  if (c) return c;
  const rng = makeRng(seed ^ 0xd06);
  const body: Fill[] = [];
  const head: Fill[] = [];
  let legWhite = false;
  let tailTipWhite = false;
  const white = '#f6f2ea';
  switch (b.pattern) {
    case 'collie': {
      // White collar, chest, belly, blaze, socks and tail tip on black.
      body.push({ path: blobPath(30, -44, 14, 30, rng, 0.3, 10), color: white });
      const belly = new Path2D();
      belly.moveTo(-40, -22);
      belly.quadraticCurveTo(-10, -30, 40, -26);
      belly.lineTo(40, 10);
      belly.lineTo(-40, 10);
      belly.closePath();
      body.push({ path: belly, color: white });
      const blaze = new Path2D();
      blaze.moveTo(-2, -12);
      blaze.quadraticCurveTo(10, -10, 22, -2);
      blaze.lineTo(26, 8);
      blaze.lineTo(16, 8);
      blaze.quadraticCurveTo(8, -4, -2, -6);
      blaze.closePath();
      head.push({ path: blaze, color: white });
      const muzzle = new Path2D();
      muzzle.rect(12, -2, 20, 14);
      head.push({ path: muzzle, color: white });
      legWhite = true;
      tailTipWhite = true;
      break;
    }
    case 'merle': {
      for (let i = 0; i < 22; i++) {
        body.push({
          path: blobPath(-50 + rng() * 90, -50 + rng() * 26, 4 + rng() * 7, 3 + rng() * 5, rng, 0.5, 7),
          color: b.marking ?? '#2b2b2b',
        });
      }
      body.push({ path: blobPath(34, -24, 14, 18, rng, 0.35, 9), color: white });
      head.push({ path: blobPath(20, 4, 12, 9, rng, 0.3, 8), color: white });
      head.push({ path: blobPath(-2, -8, 6, 5, rng, 0.5, 7), color: b.marking ?? '#2b2b2b' });
      legWhite = true;
      break;
    }
    case 'tricolor': {
      if (b.id === 'beagle') {
        // Black saddle over the back, tan head, white everywhere else.
        body.push({ path: blobPath(-8, -46, 26, 14, rng, 0.3, 10), color: '#1c1a1a' });
        body.push({ path: blobPath(30, -50, 16, 16, rng, 0.3, 9), color: b.marking ?? '#b5652e' });
        const face = new Path2D();
        face.rect(-14, -20, 60, 40);
        head.push({ path: face, color: b.marking ?? '#b5652e' });
        const blaze = new Path2D();
        blaze.moveTo(2, -12);
        blaze.quadraticCurveTo(10, -6, 20, 0);
        blaze.lineTo(30, 12);
        blaze.lineTo(10, 12);
        blaze.quadraticCurveTo(6, 0, -2, -4);
        blaze.closePath();
        head.push({ path: blaze, color: white });
      } else {
        // Bernese: black with rust points and white chest/blaze.
        body.push({ path: blobPath(34, -26, 14, 18, rng, 0.35, 9), color: white });
        const blaze = new Path2D();
        blaze.moveTo(0, -12);
        blaze.quadraticCurveTo(10, -8, 20, 0);
        blaze.lineTo(30, 12);
        blaze.lineTo(12, 12);
        blaze.quadraticCurveTo(6, 0, -2, -4);
        blaze.closePath();
        head.push({ path: blaze, color: white });
        head.push({ path: blobPath(6, -8, 2.6, 2, rng, 0.3, 6), color: b.marking ?? '#a5502a' });
        head.push({ path: blobPath(6, 8, 6, 3.5, rng, 0.3, 7), color: b.marking ?? '#a5502a' });
        legWhite = true;
      }
      break;
    }
    case 'saddle': {
      body.push({ path: blobPath(34, -30, 14, 22, rng, 0.35, 9), color: b.marking ?? white });
      body.push({ path: blobPath(0, -12, 46, 10, rng, 0.25, 10), color: b.marking ?? white });
      const muzzle = new Path2D();
      muzzle.moveTo(4, -10);
      muzzle.quadraticCurveTo(12, -6, 22, 0);
      muzzle.lineTo(32, 12);
      muzzle.lineTo(4, 12);
      muzzle.closePath();
      head.push({ path: muzzle, color: b.marking ?? white });
      legWhite = true;
      break;
    }
    default:
      break;
  }
  const m = { body, head, legWhite, tailTipWhite };
  cache.set(key, m);
  return m;
}

function legPath(kind: 'front' | 'hind', bend: number): Path2D {
  const p = new Path2D();
  const w = 4.5;
  if (kind === 'front') {
    p.moveTo(-w * 1.2, -34);
    p.quadraticCurveTo(w * 1.3, -36, w * 0.9, -20);
    p.lineTo(w * 0.7 + bend, -14);
    p.lineTo(w * 0.7 + bend * 1.8, -2);
    p.lineTo(-w * 0.7 + bend * 1.8, -2);
    p.lineTo(-w * 0.6 + bend, -14);
    p.lineTo(-w * 1.0, -22);
    p.closePath();
  } else {
    p.moveTo(-w * 2.6, -36);
    p.quadraticCurveTo(w * 1.8, -38, w * 1.6, -22);
    p.quadraticCurveTo(w * 1.1, -16, w * 0.6 - bend, -12);
    p.lineTo(w * 0.7 - bend * 1.8, -2);
    p.lineTo(-w * 0.7 - bend * 1.8, -2);
    p.lineTo(-w * 0.8 - bend, -12);
    p.quadraticCurveTo(-w * 2.2, -20, -w * 2.6, -30);
    p.closePath();
  }
  return p;
}

export function drawDog(ctx: CanvasRenderingContext2D, b: DogBreed, seed: number, pose: Pose): void {
  const m = markings(b, seed);
  ctx.save();
  ctx.scale(b.size, b.size);
  const bob = Math.sin(pose.walk * 2) * 1.2 * pose.moving;
  ctx.translate(0, bob - pose.action * 10); // little hop when barking
  const amp = 0.45 * pose.moving;
  const sw = (ph: number) => Math.sin(pose.walk + ph) * amp;
  const rng = makeRng(seed);

  const leg = (kind: 'front' | 'hind', x: number, swing: number, near: boolean) => {
    ctx.save();
    ctx.translate(x, -34);
    ctx.rotate(swing);
    ctx.translate(0, 34);
    const bend = Math.max(0, kind === 'front' ? -swing : swing) * 8;
    const path = legPath(kind, bend);
    const fills: Fill[] = [...m.body];
    if (m.legWhite) {
      const p = new Path2D();
      p.rect(-40, -12, 80, 20);
      fills.push({ path: p, color: '#f6f2ea' });
    }
    paintPart(ctx, path, b.coat, fills, [-40, 0], near ? 1 : 0.5);
    if (!near) darkenPart(ctx, path);
    strokePart(ctx, path, 1, near ? 0.3 : 0.2);
    // paw
    ctx.fillStyle = m.legWhite ? '#ebe5da' : shade(b.coat, -0.2);
    ctx.beginPath();
    ctx.ellipse(bend * 1.8 + 1, -1.5, 4.5, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  leg('hind', -24 + 5, sw(Math.PI + 0.4), false);
  leg('front', 18 + 5, sw(Math.PI), false);

  // Tail
  {
    const wag = Math.sin(pose.t * 14) * (0.3 + pose.action * 0.7) * (0.4 + pose.moving * 0.6 + pose.action);
    ctx.save();
    ctx.translate(-34, -40);
    ctx.rotate(wag * 0.5);
    const tail = new Path2D();
    if (b.tail === 'plume') {
      tail.moveTo(0, -3);
      tail.quadraticCurveTo(-14, -8, -20, -26);
      tail.quadraticCurveTo(-12, -22, -4, -12);
      tail.quadraticCurveTo(-2, -6, 0, 3);
      tail.closePath();
    } else if (b.tail === 'curl') {
      tail.arc(-4, -8, 7, 0, Math.PI * 2);
    } else {
      tail.moveTo(0, -3);
      tail.quadraticCurveTo(-10, -10, -16, -22);
      tail.quadraticCurveTo(-10, -12, -3, -6);
      tail.lineTo(0, 3);
      tail.closePath();
    }
    const tailColor = b.pattern === 'tricolor' && b.id === 'beagle' ? '#1c1a1a' : b.coat;
    paintPart(ctx, tail, tailColor, m.tailTipWhite ? [{ path: blobPath(-19, -25, 6, 6, rng, 0.3, 7), color: '#f6f2ea' }] : [], [-70, -30]);
    strokePart(ctx, tail, 1, 0.3);
    if (b.fluffy) {
      const pts: Vec[] = [];
      for (let i = 0; i < 7; i++) pts.push({ x: -3 - i * 2.5, y: -6 - i * 2.8 });
      drawTufts(ctx, pts, tailColor, 8, rng, pose.t, 1);
    }
    ctx.restore();
  }

  // Body
  const body = new Path2D();
  body.moveTo(18, -46);
  body.bezierCurveTo(4, -48, -18, -47, -30, -42);
  body.bezierCurveTo(-40, -38, -40, -24, -30, -20);
  body.bezierCurveTo(-16, -18, 0, -20, 14, -22);
  body.bezierCurveTo(26, -24, 34, -30, 34, -38);
  body.bezierCurveTo(32, -46, 26, -48, 18, -46);
  body.closePath();
  // Neck to head
  const hd = pose.headDown;
  const j: Vec = { x: 30 + hd * 8, y: -52 + hd * 26 };
  const ang = 0.2 + hd * 1.0;
  const neck = new Path2D();
  neck.moveTo(14, -46);
  neck.quadraticCurveTo(22, -56, j.x - Math.sin(ang) * 9, j.y - Math.cos(ang) * 9);
  neck.lineTo(j.x + Math.sin(ang) * 8, j.y + Math.cos(ang) * 8);
  neck.quadraticCurveTo(34, -30, 30, -26);
  neck.closePath();

  paintPart(ctx, body, b.coat, m.body, [-50, -18]);
  paintPart(ctx, neck, b.coat, m.body, [-60, -26]);
  strokePart(ctx, body, 1.1);
  strokePart(ctx, neck, 1, 0.3);
  if (b.fluffy) {
    const pts: Vec[] = [];
    for (let i = 0; i < 10; i++) pts.push({ x: -28 + i * 5.5, y: -22 + Math.sin(i) * 1.5 });
    drawTufts(ctx, pts, m.body.some((f) => f.color === '#f6f2ea') && b.pattern !== 'merle' ? '#f6f2ea' : b.coat, 7, rng, pose.t);
  }

  leg('hind', -24, sw(0.4), true);
  leg('front', 18, sw(0), true);

  // Head
  ctx.save();
  ctx.translate(j.x, j.y);
  ctx.rotate(ang);
  const head = new Path2D();
  head.moveTo(-8, -10);
  head.quadraticCurveTo(4, -14, 12, -8);
  head.quadraticCurveTo(22, -4, 30, 2); // stop and muzzle
  head.quadraticCurveTo(34, 6, 30, 10);
  head.quadraticCurveTo(20, 13, 8, 12);
  head.quadraticCurveTo(-8, 12, -12, 2);
  head.quadraticCurveTo(-13, -6, -8, -10);
  head.closePath();
  const ear = (near: boolean) => {
    ctx.save();
    ctx.translate(-4, -8);
    const flick = pose.ear * 0.3;
    const p = new Path2D();
    if (b.ears === 'up') {
      ctx.rotate((near ? -0.2 : -0.5) + flick);
      p.moveTo(-4, 0);
      p.quadraticCurveTo(-2, -14, 1, -16);
      p.quadraticCurveTo(5, -10, 5, 0);
      p.closePath();
    } else if (b.ears === 'semi') {
      ctx.rotate((near ? 0.1 : -0.3) + flick);
      p.moveTo(-4, 0);
      p.quadraticCurveTo(-3, -10, 0, -12);
      p.quadraticCurveTo(5, -8, 6, 0);
      p.closePath();
    } else {
      ctx.rotate((near ? 0.3 : 0.1) + flick * 0.5);
      p.moveTo(-3, -3);
      p.quadraticCurveTo(-10, 6, -6, 16);
      p.quadraticCurveTo(-1, 18, 3, 12);
      p.quadraticCurveTo(5, 4, 3, -3);
      p.closePath();
    }
    const earColor =
      b.id === 'beagle' ? (b.marking ?? b.coat) : b.pattern === 'saddle' ? b.coat : b.coat;
    ctx.fillStyle = near ? earColor : shade(earColor, -0.3);
    ctx.fill(p);
    strokePart(ctx, p, 1, 0.35);
    ctx.restore();
  };
  ear(false);
  paintPart(ctx, head, b.coat, m.head, [-14, 12]);
  strokePart(ctx, head, 1.1);
  // nose + mouth + tongue when action
  ctx.fillStyle = b.nose;
  ctx.beginPath();
  ctx.ellipse(31, 2, 3.2, 2.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,5,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 5);
  ctx.quadraticCurveTo(26, 10, 20, 8);
  ctx.stroke();
  if (pose.action > 0.2 || pose.chew > 0.3) {
    ctx.fillStyle = '#e57373';
    ctx.beginPath();
    ctx.ellipse(24, 12, 3.5, 2.2 + pose.action * 2, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  drawEye(ctx, 8, -3, 2.6, b.id === 'aussie' ? '#4d8fd1' : '#1a120c', pose.blink);
  ear(true);
  ctx.restore();

  ctx.restore();
}

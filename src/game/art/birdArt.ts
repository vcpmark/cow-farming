/** Chickens and ducks. */
import type { ChickenBreed, DuckBreed } from '../breeds/otherBreeds';
import { makeRng, shade } from '../util';
import { drawEye, paintPart, strokePart, type Fill, type Pose } from './common';

export function drawChicken(ctx: CanvasRenderingContext2D, b: ChickenBreed, seed: number, pose: Pose): void {
  ctx.save();
  ctx.scale(b.size, b.size);
  const hop = pose.action * 10;
  ctx.translate(0, Math.abs(Math.sin(pose.walk)) * -1.5 * pose.moving - hop);
  const rng = makeRng(seed);
  const barred: Fill[] = [];
  if (b.barred) {
    for (let i = 0; i < 14; i++) {
      const p = new Path2D();
      p.rect(-30, -34 + i * 2.6, 60, 1.2);
      barred.push({ path: p, color: '#ececec' });
    }
  }

  // Legs (skinny, scaled)
  const leg = (x: number, phase: number) => {
    const swing = Math.sin(pose.walk + phase) * 0.6 * pose.moving;
    ctx.save();
    ctx.translate(x, -10);
    ctx.rotate(swing);
    ctx.strokeStyle = '#e0a03a';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 10);
    ctx.moveTo(0, 10);
    ctx.lineTo(4, 10);
    ctx.moveTo(0, 10);
    ctx.lineTo(-3, 10);
    ctx.moveTo(0, 10);
    ctx.lineTo(2, 8);
    ctx.stroke();
    ctx.restore();
  };
  leg(-1, Math.PI);

  // Tail feathers
  const tail = new Path2D();
  const tl = b.rooster ? 1.35 : 1;
  tail.moveTo(-10, -18);
  tail.quadraticCurveTo(-24, -22, -30 * tl, -30 * tl);
  tail.quadraticCurveTo(-20, -28, -18, -24);
  tail.quadraticCurveTo(-24, -32, -26 * tl, -40 * tl);
  tail.quadraticCurveTo(-16, -32, -14, -26);
  tail.quadraticCurveTo(-16, -36, -12 * tl, -44 * tl);
  tail.quadraticCurveTo(-10, -32, -8, -26);
  tail.closePath();
  paintPart(ctx, tail, b.tail, [], [-48, -20]);
  strokePart(ctx, tail, 0.9, 0.35);

  // Body: plump teardrop
  const body = new Path2D();
  body.moveTo(10, -30);
  body.bezierCurveTo(2, -34, -14, -32, -16, -22);
  body.bezierCurveTo(-18, -12, -8, -6, 2, -7);
  body.bezierCurveTo(12, -8, 18, -16, 14, -24);
  body.bezierCurveTo(13, -27, 12, -29, 10, -30);
  body.closePath();
  paintPart(ctx, body, b.body, barred, [-34, -6]);
  // wing
  const wing = new Path2D();
  const flap = pose.action * 0.8;
  ctx.save();
  ctx.translate(2, -24);
  ctx.rotate(-flap);
  wing.moveTo(0, 0);
  wing.quadraticCurveTo(-10, 2, -12, 10);
  wing.quadraticCurveTo(-4, 12, 4, 6);
  wing.closePath();
  paintPart(ctx, wing, shade(b.body, -0.12), barred, [-4, 12]);
  strokePart(ctx, wing, 0.8, 0.3);
  ctx.restore();
  if (b.silkie) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      const a = rng() * Math.PI * 2;
      const x = -4 + Math.cos(a) * 12;
      const y = -20 + Math.sin(a) * 10;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5);
      ctx.stroke();
    }
  }
  strokePart(ctx, body, 0.9, 0.4);
  leg(3, 0);

  // Neck and head: chickens carry the head close to the body.
  const hd = pose.headDown;
  ctx.save();
  ctx.translate(9 + hd * 4, -28 + hd * 16);
  const peck = Math.sin(pose.t * 12) * hd * 0.15;
  ctx.rotate(hd * 0.9 + peck);
  const neck = new Path2D();
  neck.moveTo(-6, 5);
  neck.quadraticCurveTo(-5, -4, -1, -6);
  neck.lineTo(6, -5);
  neck.quadraticCurveTo(6, 1, 3, 6);
  neck.closePath();
  paintPart(ctx, neck, b.body, barred, [-8, 6]);
  const hy = -9;
  const head = new Path2D();
  head.arc(1, hy, 6.2, 0, Math.PI * 2);
  paintPart(ctx, head, b.body, [], [hy - 6, hy + 6]);
  // comb
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath();
  if (b.silkie) {
    ctx.fillStyle = b.body;
    ctx.ellipse(0, hy - 6, 5.5, 4, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(-5, hy - 2);
    for (let i = 0; i < 4; i++) {
      ctx.quadraticCurveTo(-4 + i * 3 + 1.5, hy - 12 - (i === 1 ? 2 : 0), -4 + i * 3 + 3, hy - 4);
    }
    ctx.lineTo(5, hy - 2);
    ctx.closePath();
  }
  ctx.fill();
  strokePart(ctx, head, 0.8, 0.35);
  // beak
  ctx.fillStyle = '#f5b73b';
  ctx.beginPath();
  ctx.moveTo(6, hy - 1);
  ctx.lineTo(13, hy + 1.5);
  ctx.lineTo(6, hy + 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // wattle
  ctx.fillStyle = '#d32f2f';
  ctx.beginPath();
  ctx.ellipse(5, hy + 7, 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  drawEye(ctx, 3, hy - 1.5, 1.4, '#1a120c', pose.blink);
  ctx.restore();
  ctx.restore();
}

export function drawDuck(ctx: CanvasRenderingContext2D, b: DuckBreed, seed: number, pose: Pose, swimming = false): void {
  ctx.save();
  ctx.scale(b.size, b.size);
  void seed;
  const runner = b.id === 'indianrunner';
  const waddle = Math.sin(pose.walk) * 0.12 * pose.moving;
  ctx.rotate(swimming ? 0 : waddle);
  if (swimming) ctx.translate(0, 6 + Math.sin(pose.t * 2) * 1);
  ctx.translate(0, -pose.action * 6);

  if (!swimming) {
    for (const [x, ph] of [
      [-2, Math.PI],
      [3, 0],
    ] as const) {
      const swing = Math.sin(pose.walk + ph) * 0.5 * pose.moving;
      ctx.save();
      ctx.translate(x, -9);
      ctx.rotate(swing);
      ctx.strokeStyle = b.feet;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 8);
      ctx.stroke();
      ctx.fillStyle = b.feet;
      ctx.beginPath();
      ctx.moveTo(-4, 9);
      ctx.lineTo(6, 9);
      ctx.lineTo(1, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // Body
  const body = new Path2D();
  if (runner) {
    body.moveTo(6, -36);
    body.bezierCurveTo(14, -30, 12, -12, 4, -8);
    body.bezierCurveTo(-4, -6, -14, -10, -18, -20);
    body.bezierCurveTo(-20, -28, -10, -34, -2, -36);
    body.closePath();
  } else {
    body.moveTo(14, -22);
    body.bezierCurveTo(10, -28, -8, -30, -18, -24);
    body.bezierCurveTo(-24, -20, -30, -22, -30, -24); // tail
    body.bezierCurveTo(-26, -12, -14, -8, 0, -8);
    body.bezierCurveTo(10, -8, 18, -14, 14, -22);
    body.closePath();
  }
  paintPart(ctx, body, b.body, [], [-36, -8]);
  // wing
  const wing = new Path2D();
  ctx.save();
  ctx.translate(2, -22);
  ctx.rotate(-pose.action * 0.9);
  wing.moveTo(0, 0);
  wing.quadraticCurveTo(-12, -2, -18, 6);
  wing.quadraticCurveTo(-8, 8, 2, 4);
  wing.closePath();
  paintPart(ctx, wing, shade(b.body, -0.15), [], [-4, 8]);
  strokePart(ctx, wing, 0.8, 0.3);
  ctx.restore();
  strokePart(ctx, body, 0.9, 0.4);
  if (b.id === 'mallard') {
    // curly drake tail feather
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-24, -22);
    ctx.quadraticCurveTo(-32, -30, -26, -30);
    ctx.stroke();
  }

  // Neck + head
  const hd = pose.headDown;
  ctx.save();
  ctx.translate(runner ? 4 : 10, runner ? -36 : -24);
  ctx.rotate(hd * 1.1);
  const neck = new Path2D();
  neck.moveTo(-5, 4);
  neck.quadraticCurveTo(-3, -8, 0, -14);
  neck.lineTo(6, -12);
  neck.quadraticCurveTo(6, -2, 5, 4);
  neck.closePath();
  paintPart(ctx, neck, b.head, [], [-16, 4]);
  if (b.ring) {
    ctx.fillStyle = '#f5f2ea';
    ctx.beginPath();
    ctx.ellipse(1, -1, 5.5, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const head = new Path2D();
  head.ellipse(2, -17, 7, 5.5, 0.1, 0, Math.PI * 2);
  paintPart(ctx, head, b.head, [], [-23, -11]);
  strokePart(ctx, head, 0.8, 0.35);
  // bill
  ctx.fillStyle = b.bill;
  ctx.beginPath();
  ctx.moveTo(8, -19);
  ctx.quadraticCurveTo(18, -18, 19, -15.5);
  ctx.quadraticCurveTo(18, -13, 8, -13.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 0.7;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(9, -16);
  ctx.lineTo(18, -15.5);
  ctx.stroke();
  drawEye(ctx, 4, -18.5, 1.4, '#1a120c', pose.blink);
  ctx.restore();
  ctx.restore();
}

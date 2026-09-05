/** Farmers: simple friendly bipeds in overalls and boots. */
import type { FarmerSpec } from '../breeds/otherBreeds';
import { shade } from '../util';
import { drawEye, paintPart, strokePart, type Pose } from './common';

export function drawFarmer(ctx: CanvasRenderingContext2D, f: FarmerSpec, seed: number, pose: Pose): void {
  void seed;
  ctx.save();
  ctx.scale(f.size, f.size);
  const bob = Math.abs(Math.sin(pose.walk)) * -2 * pose.moving;
  ctx.translate(0, bob - pose.action * 12);
  const swing = Math.sin(pose.walk) * 0.6 * pose.moving;
  const wave = pose.action;

  const leg = (x: number, ang: number, near: boolean) => {
    ctx.save();
    ctx.translate(x, -36);
    ctx.rotate(ang);
    const p = new Path2D();
    p.moveTo(-5, 0);
    p.lineTo(5, 0);
    p.lineTo(4.5, 26);
    p.lineTo(-4.5, 26);
    p.closePath();
    paintPart(ctx, p, near ? f.overalls : shade(f.overalls, -0.25), [], [0, 26]);
    strokePart(ctx, p, 1, 0.3);
    // boot
    ctx.fillStyle = near ? f.boots : shade(f.boots, -0.25);
    ctx.beginPath();
    ctx.moveTo(-5, 26);
    ctx.lineTo(5, 26);
    ctx.lineTo(8, 34);
    ctx.lineTo(8, 36);
    ctx.lineTo(-5, 36);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.restore();
  };
  const arm = (x: number, ang: number, near: boolean) => {
    ctx.save();
    ctx.translate(x, -62);
    ctx.rotate(ang);
    const p = new Path2D();
    p.moveTo(-3.5, 0);
    p.lineTo(3.5, 0);
    p.lineTo(3, 22);
    p.lineTo(-3, 22);
    p.closePath();
    paintPart(ctx, p, near ? f.shirt : shade(f.shirt, -0.25), [], [0, 22]);
    strokePart(ctx, p, 0.9, 0.3);
    ctx.fillStyle = f.skin;
    ctx.beginPath();
    ctx.arc(0, 24, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  leg(-5, -swing, false);
  arm(-6, swing * 0.8, false);

  // Torso: shirt with overalls bib.
  const torso = new Path2D();
  torso.moveTo(-11, -66);
  torso.lineTo(11, -66);
  torso.lineTo(12, -36);
  torso.lineTo(-12, -36);
  torso.closePath();
  paintPart(ctx, torso, f.shirt, [], [-66, -36]);
  const bib = new Path2D();
  bib.moveTo(-6, -60);
  bib.lineTo(6, -60);
  bib.lineTo(8, -50);
  bib.lineTo(12, -50);
  bib.lineTo(12, -36);
  bib.lineTo(-12, -36);
  bib.lineTo(-12, -50);
  bib.lineTo(-8, -50);
  bib.closePath();
  paintPart(ctx, bib, f.overalls, [], [-60, -36]);
  // straps
  ctx.strokeStyle = f.overalls;
  ctx.lineWidth = 3;
  for (const sx of [-5, 5]) {
    ctx.beginPath();
    ctx.moveTo(sx, -60);
    ctx.lineTo(sx * 1.4, -66);
    ctx.stroke();
  }
  strokePart(ctx, torso, 1, 0.3);
  strokePart(ctx, bib, 1, 0.3);
  // pocket
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(-4, -56, 8, 6);

  leg(5, swing, true);
  arm(7, wave > 0.05 ? -2.6 + Math.sin(pose.t * 10) * 0.4 * wave : -swing * 0.8, true);

  // Head
  ctx.save();
  ctx.translate(0, -76);
  const head = new Path2D();
  head.ellipse(0, 0, 9.5, 10.5, 0, 0, Math.PI * 2);
  paintPart(ctx, head, f.skin, [], [-10, 10], 0.6);
  // hair
  ctx.fillStyle = f.hair;
  ctx.beginPath();
  ctx.ellipse(-1, -5, 9.5, 6.5, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  if (f.hat === 'none') {
    ctx.beginPath();
    ctx.ellipse(-8, -1, 3, 6, 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  strokePart(ctx, head, 1, 0.35);
  // face
  drawEye(ctx, 4, -1, 1.6, '#2a1d14', pose.blink);
  ctx.strokeStyle = 'rgba(80,30,20,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(4, 4, 3, 0.15, Math.PI - 0.3);
  ctx.stroke();
  ctx.fillStyle = 'rgba(230,120,110,0.35)';
  ctx.beginPath();
  ctx.ellipse(6, 3, 2.4, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();
  // nose
  ctx.strokeStyle = 'rgba(80,30,20,0.5)';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.quadraticCurveTo(10, 2, 8, 3.5);
  ctx.stroke();
  // hat
  if (f.hat === 'straw') {
    ctx.fillStyle = '#e6c56a';
    ctx.beginPath();
    ctx.ellipse(0, -7, 17, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,20,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#efd27a';
    ctx.beginPath();
    ctx.moveTo(-9, -7);
    ctx.quadraticCurveTo(-9, -18, 0, -18);
    ctx.quadraticCurveTo(9, -18, 9, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8d3b2a';
    ctx.fillRect(-9, -10, 18, 2.5);
  } else if (f.hat === 'cap') {
    ctx.fillStyle = '#3a6ea5';
    ctx.beginPath();
    ctx.moveTo(-10, -6);
    ctx.quadraticCurveTo(-10, -17, 0, -17);
    ctx.quadraticCurveTo(10, -17, 10, -6);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4, -7);
    ctx.lineTo(18, -6);
    ctx.lineTo(16, -3);
    ctx.lineTo(4, -4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

/** A classic farm tractor with big rear wheels, optional hay trailer. */
import type { TractorSpec } from '../breeds/otherBreeds';
import { shade } from '../util';
import { paintPart, strokePart, type Pose } from './common';

function wheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: TractorSpec, spin: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = t.wheels;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // tread lugs
  ctx.fillStyle = shade(t.wheels, 0.18);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(r - 4, -2, 4, 4);
    ctx.restore();
  }
  ctx.fillStyle = t.rims;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = shade(t.rims, -0.35);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // spokes/bolts
  ctx.fillStyle = shade(t.rims, -0.3);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, r * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawTractor(ctx: CanvasRenderingContext2D, t: TractorSpec, seed: number, pose: Pose): void {
  void seed;
  ctx.save();
  ctx.scale(t.size, t.size);
  const spin = pose.walk * 0.6;
  const rumble = Math.sin(pose.t * 40) * 0.4 * (0.3 + pose.moving);
  ctx.translate(0, rumble);

  if (t.trailer) {
    ctx.save();
    ctx.translate(-92, 0);
    // hitch
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(30, -18);
    ctx.lineTo(48, -18);
    ctx.stroke();
    const bed = new Path2D();
    bed.rect(-34, -40, 66, 24);
    paintPart(ctx, bed, '#8d6e4c', [], [-40, -16]);
    strokePart(ctx, bed, 1.2, 0.5);
    ctx.strokeStyle = 'rgba(60,35,15,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-34 + i * 16, -40);
      ctx.lineTo(-34 + i * 16, -16);
      ctx.stroke();
    }
    // hay
    ctx.fillStyle = '#e3c25a';
    ctx.beginPath();
    ctx.moveTo(-32, -40);
    ctx.quadraticCurveTo(-20, -60, 0, -56);
    ctx.quadraticCurveTo(20, -62, 30, -40);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,20,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.moveTo(-26 + i * 5, -44 - (i % 3) * 3);
      ctx.lineTo(-22 + i * 5, -52 + (i % 2) * 3);
      ctx.stroke();
    }
    wheel(ctx, -10, -13, 13, t, spin * 1.6);
    ctx.restore();
  }

  // Rear big wheel (far side fender first)
  const body = t.body;
  // engine hood
  const hood = new Path2D();
  hood.moveTo(-6, -56);
  hood.lineTo(48, -56);
  hood.quadraticCurveTo(56, -56, 56, -48);
  hood.lineTo(56, -32);
  hood.lineTo(-6, -32);
  hood.closePath();
  // chassis between wheels
  const chassis = new Path2D();
  chassis.rect(-40, -34, 80, 16);
  paintPart(ctx, chassis, '#444', [], [-34, -18]);
  strokePart(ctx, chassis, 1, 0.4);

  // seat/cab
  const cab = new Path2D();
  cab.moveTo(-34, -58);
  cab.lineTo(-10, -58);
  cab.lineTo(-10, -34);
  cab.lineTo(-40, -34);
  cab.closePath();
  paintPart(ctx, cab, shade(body, -0.15), [], [-58, -34]);
  strokePart(ctx, cab, 1.1, 0.45);
  // seat
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.moveTo(-34, -60);
  ctx.quadraticCurveTo(-36, -74, -30, -76);
  ctx.lineTo(-24, -76);
  ctx.lineTo(-24, -60);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-36, -62, 22, 4);
  // roll bar
  ctx.strokeStyle = shade(body, -0.3);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, -58);
  ctx.lineTo(-14, -96);
  ctx.lineTo(-40, -96);
  ctx.lineTo(-40, -58);
  ctx.stroke();
  // steering wheel
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-14, -62);
  ctx.lineTo(-4, -74);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(-4, -75, 3, 7, -0.4, 0, Math.PI * 2);
  ctx.stroke();

  paintPart(ctx, hood, body, [], [-56, -32]);
  strokePart(ctx, hood, 1.2, 0.5);
  // grille & headlight
  ctx.fillStyle = '#333';
  ctx.fillRect(48, -50, 6, 14);
  ctx.fillStyle = '#ffe082';
  ctx.beginPath();
  ctx.arc(52, -52, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // hood stripe & vents
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(-6, -54, 54, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(4 + i * 6, -46);
    ctx.lineTo(4 + i * 6, -38);
    ctx.stroke();
  }
  // exhaust pipe
  ctx.fillStyle = '#555';
  ctx.fillRect(28, -82, 5, 26);
  ctx.fillStyle = '#333';
  ctx.fillRect(26, -84, 9, 4);
  // fender over the rear wheel
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(-30, -26, 30, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(0, -34);
  ctx.lineTo(-60, -34);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  wheel(ctx, -30, -26, 26, t, spin);
  wheel(ctx, 38, -14, 14, t, spin * 1.8);
  ctx.restore();
}

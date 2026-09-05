/**
 * Renders the app icon and iPhone launch screens. Used by scripts/icons.mjs
 * through the ?icon=SIZE and ?splash=WxH URL parameters.
 */
import { COW_BREEDS } from './game/breeds/cowBreeds';
import { drawCow, drawGroundShadow, IDLE_COW_POSE } from './game/art/cowArt';
import { roundRectPath } from './game/util';

const holstein = COW_BREEDS[0];

export function renderIcon(canvas: HTMLCanvasElement, size: number, maskable: boolean): void {
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d')!;
  // Background: sky over a grassy hill, rounded unless maskable (the OS masks it).
  const r = maskable ? 0 : size * 0.22;
  ctx.save();
  ctx.clip(roundRectPath(0, 0, size, size, r));
  const sky = ctx.createLinearGradient(0, 0, 0, size);
  sky.addColorStop(0, '#4a9be6');
  sky.addColorStop(1, '#bfe6ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  ctx.globalAlpha = 0.9;
  for (const [x, y, rr] of [
    [0.22, 0.2, 0.09],
    [0.3, 0.18, 0.11],
    [0.38, 0.22, 0.08],
  ]) {
    ctx.beginPath();
    ctx.arc(x * size, y * size, rr * size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#6fae52';
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 0.98, size * 0.75, size * 0.42, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#9ad25b';
  ctx.beginPath();
  ctx.ellipse(size * 0.5, size * 1.08, size * 0.85, size * 0.4, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  // The cow, scaled to fit the safe zone.
  const pad = maskable ? 0.16 : 0.08;
  const s = (size * (1 - pad * 2)) / 200;
  ctx.translate(size * 0.47, size * (0.88 - pad * 0.6));
  ctx.scale(s, s);
  drawGroundShadow(ctx, 80, 0.25);
  drawCow(ctx, holstein, 91, { ...IDLE_COW_POSE, t: 1 });
  ctx.restore();
}

export function renderSplash(canvas: HTMLCanvasElement, w: number, h: number): void {
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d')!;
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, '#4a9be6');
  sky.addColorStop(1, '#c8ecff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const horizon = h * 0.62;
  ctx.fillStyle = '#7fa6c9';
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  for (let x = 0; x <= w; x += 20) ctx.lineTo(x, horizon - 40 - Math.sin(x / 260) * 60 * (0.6 + 0.4 * Math.sin(x / 90)));
  ctx.lineTo(w, horizon);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6fae52';
  ctx.beginPath();
  ctx.moveTo(0, horizon + 10);
  for (let x = 0; x <= w; x += 20) ctx.lineTo(x, horizon - 10 - Math.sin(x / 180 + 2) * 30);
  ctx.lineTo(w, horizon + 10);
  ctx.closePath();
  ctx.fill();
  const g = ctx.createLinearGradient(0, horizon, 0, h);
  g.addColorStop(0, '#7cc04f');
  g.addColorStop(1, '#9ad25b');
  ctx.fillStyle = g;
  ctx.fillRect(0, horizon, w, h - horizon);
  // Cow
  const base = Math.min(w, h);
  const s = base / 420;
  ctx.save();
  ctx.translate(w * 0.5, horizon + (h - horizon) * 0.62);
  ctx.scale(s, s);
  drawGroundShadow(ctx, 80, 0.25);
  drawCow(ctx, holstein, 91, { ...IDLE_COW_POSE, t: 1 });
  ctx.restore();
  // Title
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#2e5a37';
  ctx.lineWidth = base * 0.02;
  ctx.lineJoin = 'round';
  ctx.font = `bold ${base * 0.13}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText('Farm Friends', w / 2, h * 0.24);
  ctx.fillText('Farm Friends', w / 2, h * 0.24);
}

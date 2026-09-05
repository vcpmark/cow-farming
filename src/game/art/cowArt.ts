/**
 * Procedural side-view cow renderer.
 *
 * Every cow is drawn from real bovine anatomy: a deep barrel with a level top
 * line, sloping rump and tail head, a long wedge shaped head with a broad
 * muzzle, angled hind legs with hocks, and an udder on the dairy breeds.
 * Breed markings are painted inside clipped body parts so Holstein patches,
 * Galloway belts and Hereford white faces land where they do on real animals.
 *
 * Coordinate system: origin on the ground between the legs, cow faces +x,
 * y grows downward (canvas). A standard cow is ~170 units nose to tail.
 */
import type { CowBreed } from '../breeds/cowBreeds';
import { blobPath, cubicPoint, lerp, makeRng, rgba, shade, type Vec } from '../util';

export interface CowPose {
  /** Walk cycle phase in radians. */
  walk: number;
  /** 0 = standing, 1 = full stride. */
  moving: number;
  /** 0 = head up, 1 = grazing. */
  headDown: number;
  /** 0..1 chewing mouth open. */
  chew: number;
  /** -1..1 tail swish. */
  tail: number;
  /** 0..1 ear flick. */
  ear: number;
  /** 0..1 eyes closed. */
  blink: number;
  /** Time in seconds, for subtle idle motion. */
  t: number;
}

export const IDLE_COW_POSE: CowPose = {
  walk: 0,
  moving: 0,
  headDown: 0,
  chew: 0,
  tail: 0,
  ear: 0,
  blink: 0,
  t: 0,
};

interface Proportions {
  bodyDepth: number; // vertical scale of the barrel
  legThick: number;
  legLen: number;
  neckThick: number;
  rump: number; // how rounded/heavy the hindquarters are
}

function proportions(b: CowBreed): Proportions {
  switch (b.build) {
    case 'dairy':
      return { bodyDepth: 1, legThick: 0.9, legLen: 1, neckThick: 0.9, rump: 0.95 };
    case 'beef':
      return { bodyDepth: 1.1, legThick: 1.2, legLen: 0.9, neckThick: 1.25, rump: 1.15 };
    case 'lean':
      return { bodyDepth: 0.92, legThick: 0.85, legLen: 1.05, neckThick: 0.85, rump: 0.9 };
  }
}

/** Cached per-animal markings so patterns are stable frame to frame. */
interface Markings {
  patches: Path2D[];
  speckles: Vec[];
  belt?: Path2D;
  bellyWhite?: Path2D;
  headBlaze?: Path2D;
  headStar?: Path2D;
  sizeJitter: number;
}

const markingCache = new Map<string, Markings>();

const BODY_X0 = -66; // rump
const BODY_X1 = 54; // chest
const BODY_Y0 = -70; // back
const BODY_Y1 = -24; // belly

function buildMarkings(breed: CowBreed, seed: number): Markings {
  const key = `${breed.id}:${seed}`;
  const cached = markingCache.get(key);
  if (cached) return cached;
  const rng = makeRng(seed ^ 0x9e3779b9);
  const patches: Path2D[] = [];
  const speckles: Vec[] = [];

  if (breed.patches) {
    for (const p of breed.patches) {
      const j = (p.jitter ?? 0.5) * 0.12;
      const cx = lerp(BODY_X0, BODY_X1, p.x + (rng() - 0.5) * 2 * j);
      const cy = lerp(BODY_Y0, BODY_Y1, p.y + (rng() - 0.5) * 2 * j);
      const rx = p.r * (BODY_X1 - BODY_X0) * (0.85 + rng() * 0.3);
      const ry = (p.ry ?? p.r) * (BODY_Y1 - BODY_Y0) * (0.85 + rng() * 0.3);
      patches.push(blobPath(cx, cy, rx, ry, rng, 0.45, 10));
    }
    // Every animal gets a couple of small extra spots so no two look the same.
    const extra = breed.pattern === 'patches' ? 1 + Math.floor(rng() * 3) : 0;
    for (let i = 0; i < extra; i++) {
      const cx = lerp(BODY_X0 + 10, BODY_X1 - 10, rng());
      const cy = lerp(BODY_Y0 + 6, BODY_Y1 - 12, rng());
      const r = 5 + rng() * 9;
      patches.push(blobPath(cx, cy, r * 1.4, r, rng, 0.5, 8));
    }
  }

  if (breed.pattern === 'speckle' && breed.speckles) {
    for (let i = 0; i < breed.speckles; i++) {
      speckles.push({
        x: lerp(BODY_X0 + 4, BODY_X1 + 30, rng()),
        y: lerp(BODY_Y0 - 10, BODY_Y1 + 6, rng()),
      });
    }
  }

  let belt: Path2D | undefined;
  if (breed.pattern === 'belt') {
    const x0 = -34 + (rng() - 0.5) * 8;
    const w = 34 + rng() * 8;
    belt = new Path2D();
    belt.moveTo(x0, BODY_Y0 - 20);
    // wobbly left edge
    for (let y = BODY_Y0 - 20; y <= BODY_Y1 + 40; y += 8) belt.lineTo(x0 + (rng() - 0.5) * 5, y);
    for (let y = BODY_Y1 + 40; y >= BODY_Y0 - 20; y -= 8) belt.lineTo(x0 + w + (rng() - 0.5) * 5, y);
    belt.closePath();
  }

  let bellyWhite: Path2D | undefined;
  if (breed.whiteBelly) {
    bellyWhite = new Path2D();
    const yTop = -38;
    bellyWhite.moveTo(BODY_X0 - 20, yTop + 6);
    let x = BODY_X0 - 20;
    let y = yTop;
    while (x < BODY_X1 + 30) {
      const nx = x + 18 + rng() * 10;
      const ny = yTop + (rng() - 0.5) * 12;
      bellyWhite.quadraticCurveTo((x + nx) / 2, y + (rng() - 0.5) * 14, nx, ny);
      x = nx;
      y = ny;
    }
    bellyWhite.lineTo(BODY_X1 + 30, 30);
    bellyWhite.lineTo(BODY_X0 - 20, 30);
    bellyWhite.closePath();
  }

  // Head markings live in head-local coordinates (see drawHead).
  let headBlaze: Path2D | undefined;
  let headStar: Path2D | undefined;
  if (breed.head === 'blaze' || (breed.head === 'dark' && rng() < 0.65)) {
    headBlaze = new Path2D();
    const w = 3 + rng() * 2.5;
    headBlaze.moveTo(-2, -13);
    headBlaze.quadraticCurveTo(14, -12 - w, 30, -6);
    headBlaze.lineTo(36, 2);
    headBlaze.lineTo(30, -1);
    headBlaze.quadraticCurveTo(14, -6 + w, 2, -8);
    headBlaze.closePath();
  } else if (breed.head === 'coat' && breed.pattern === 'solid' && rng() < 0.25 && breed.coat !== '#efe6d3') {
    headStar = blobPath(6, -8, 3, 2.5, rng, 0.4, 7);
  }

  const m: Markings = { patches, speckles, belt, bellyWhite, headBlaze, headStar, sizeJitter: 0.95 + rng() * 0.1 };
  markingCache.set(key, m);
  return m;
}

// ---- anatomy paths ---------------------------------------------------------

interface Anatomy {
  body: Path2D;
  bellyCurve: [Vec, Vec, Vec, Vec][]; // bezier segments along belly (for shaggy fur)
  topCurve: [Vec, Vec, Vec, Vec][];
  neck: Path2D;
  junction: Vec; // where the head attaches
  headAngle: number;
  withers: Vec;
  chest: Vec;
}

function buildAnatomy(p: Proportions, pose: CowPose): Anatomy {
  const d = p.bodyDepth;
  const r = p.rump;
  const body = new Path2D();
  // Withers sit at about 70 units; the barrel takes the upper 45 of that and
  // the legs the lower 50, which is the proportion of a real dairy cow.
  const withers: Vec = { x: 28, y: -70 * d };
  const hooks: Vec = { x: -52, y: -68 * d };
  const tailHead: Vec = { x: -66, y: -60 * d };
  const pins: Vec = { x: -66 * r, y: -42 * d };
  const flank: Vec = { x: -44, y: -31 };
  const bellyLow: Vec = { x: -4, y: -24 };
  const brisket: Vec = { x: 40, y: -30 };
  const chest: Vec = { x: 54, y: -46 * d };

  const topCurve: [Vec, Vec, Vec, Vec][] = [
    [withers, { x: 8, y: -73 * d }, { x: -30, y: -71 * d }, hooks],
    [hooks, { x: -62, y: -67 * d }, tailHead, tailHead],
  ];
  const bellyCurve: [Vec, Vec, Vec, Vec][] = [
    [tailHead, { x: -70 * r, y: -52 * d }, { x: -70 * r, y: -46 * d }, pins],
    [pins, { x: -66 * r, y: -34 }, { x: -56, y: -31 }, flank],
    [flank, { x: -30, y: -24 }, { x: -18, y: -23 }, bellyLow],
    [bellyLow, { x: 14, y: -25 }, { x: 30, y: -26 }, brisket],
    [brisket, { x: 52, y: -34 }, { x: 58, y: -38 * d }, chest],
  ];

  body.moveTo(withers.x, withers.y);
  for (const [, c1, c2, e] of topCurve) body.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y);
  for (const [, c1, c2, e] of bellyCurve) body.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, e.x, e.y);
  body.bezierCurveTo(52, -60 * d, 40, -70 * d, withers.x, withers.y);
  body.closePath();

  // Head junction moves down and forward as the cow lowers its head to graze.
  const hd = pose.headDown;
  const junction: Vec = { x: lerp(68, 74, hd), y: lerp(-68 * d, -40, hd) };
  const headAngle = lerp(0.3, 1.3, hd);
  const nt = p.neckThick;

  const neck = new Path2D();
  const jTop = { x: junction.x - Math.sin(headAngle) * 12 * nt, y: junction.y - Math.cos(headAngle) * 12 * nt };
  const jBot = { x: junction.x + Math.sin(headAngle) * 11 * nt, y: junction.y + Math.cos(headAngle) * 11 * nt };
  neck.moveTo(22, -66 * d);
  neck.quadraticCurveTo(lerp(48, 44, hd), lerp(-78 * d, -66 * d, hd), jTop.x, jTop.y);
  neck.lineTo(jBot.x, jBot.y);
  neck.quadraticCurveTo(lerp(58, 64, hd), lerp(-46 * d, -40, hd), 46, -34);
  neck.lineTo(30, -48 * d);
  neck.closePath();

  return { body, bellyCurve, topCurve, neck, junction, headAngle, withers, chest };
}

// ---- painting helpers ------------------------------------------------------

function paintCoat(
  ctx: CanvasRenderingContext2D,
  part: Path2D,
  breed: CowBreed,
  m: Markings,
  opts: { light: number; socksY?: number; skipMarkings?: boolean },
): void {
  ctx.save();
  ctx.clip(part);
  ctx.fillStyle = breed.coat;
  ctx.fill(part);

  if (!opts.skipMarkings) {
    if (breed.marking && m.patches.length) {
      ctx.fillStyle = breed.marking;
      for (const p of m.patches) ctx.fill(p);
    }
    if (breed.marking && m.speckles.length) {
      ctx.fillStyle = breed.marking;
      for (let i = 0; i < m.speckles.length; i++) {
        const s = m.speckles[i];
        const rad = 1 + ((i * 7) % 5) * 0.5;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, rad * 1.5, rad, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (m.belt && breed.marking) {
      ctx.fillStyle = breed.marking;
      ctx.fill(m.belt);
    }
    if (m.bellyWhite) {
      ctx.fillStyle = breed.marking ?? '#f6f1e6';
      ctx.fill(m.bellyWhite);
    }
    if (opts.socksY !== undefined && breed.whiteSocks) {
      ctx.fillStyle = breed.marking ?? '#f6f1e6';
      ctx.fillRect(-200, opts.socksY, 400, 200);
    }
    if (breed.shading) {
      // Jersey style: darker over the shoulders, hips and head, lighter through the belly.
      for (const [cx, cy, rad] of [
        [34, -54, 40],
        [-52, -56, 42],
      ] as const) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, rgba(breed.shading, 0.55));
        g.addColorStop(1, rgba(breed.shading, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-200, -200, 400, 400);
      }
    }
  }

  // Volume shading: light along the top line, shadow under the belly.
  const g = ctx.createLinearGradient(0, -76, 0, 2);
  g.addColorStop(0, `rgba(255,255,255,${0.14 * opts.light})`);
  g.addColorStop(0.4, 'rgba(255,255,255,0)');
  g.addColorStop(0.62, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g;
  ctx.fillRect(-200, -200, 400, 400);
  ctx.restore();
}

function outline(ctx: CanvasRenderingContext2D, part: Path2D, width = 1.4, alpha = 0.45): void {
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(30,20,15,${alpha})`;
  ctx.lineWidth = width;
  ctx.stroke(part);
}

/** Tapered horn along a quadratic curve. */
function drawHorn(
  ctx: CanvasRenderingContext2D,
  from: Vec,
  ctrl: Vec,
  to: Vec,
  baseWidth: number,
  color: string,
): void {
  const steps = 14;
  let prev = from;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const pt = {
      x: mt * mt * from.x + 2 * mt * t * ctrl.x + t * t * to.x,
      y: mt * mt * from.y + 2 * mt * t * ctrl.y + t * t * to.y,
    };
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, baseWidth * (1 - t * 0.85));
    ctx.strokeStyle = t > 0.8 ? shade(color, -0.45) : color;
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    prev = pt;
  }
  // A faint darker line along the lower edge gives the horn some roundness.
  ctx.strokeStyle = 'rgba(40,25,10,0.28)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y + baseWidth * 0.3);
  ctx.quadraticCurveTo(ctrl.x, ctrl.y + baseWidth * 0.25, to.x, to.y);
  ctx.stroke();
}

function drawHorns(ctx: CanvasRenderingContext2D, breed: CowBreed, near: boolean): void {
  const c = near ? breed.hornColor : shade(breed.hornColor, -0.2);
  const base: Vec = { x: -2, y: -13 };
  const dir = near ? 1 : -1; // near horn tends forward, far horn back
  switch (breed.horns) {
    case 'none':
      return;
    case 'short':
      drawHorn(ctx, base, { x: base.x + 6 * dir, y: -21 }, { x: base.x + 11 * dir, y: -24 }, 4.6, c);
      return;
    case 'curvedDown':
      drawHorn(ctx, base, { x: base.x + 13 * dir, y: -19 }, { x: base.x + 14 * dir, y: -3 }, 5, c);
      return;
    case 'lyre':
      drawHorn(ctx, base, { x: base.x + 15 * dir, y: -20 }, { x: base.x + 11 * dir, y: -38 }, 4.8, c);
      return;
    case 'longhorn':
      // Real longhorns sweep sideways; in side view the near horn curves out
      // toward the viewer and up, the far one back. Thick base, gentle S curve.
      drawHorn(
        ctx,
        { x: base.x, y: base.y + 3 },
        { x: base.x + 34 * dir, y: -4 },
        { x: base.x + 60 * dir, y: -24 },
        9.5,
        c,
      );
      return;
    case 'highland':
      drawHorn(ctx, base, { x: base.x + 30 * dir, y: -20 }, { x: base.x + 29 * dir, y: -44 }, 7, c);
      return;
  }
}

function drawEar(ctx: CanvasRenderingContext2D, breed: CowBreed, headColor: string, near: boolean, flick: number): void {
  const s = breed.ears ?? 1;
  ctx.save();
  ctx.translate(-1, -9);
  ctx.rotate((near ? 0.25 : -0.05) - flick * 0.35);
  ctx.beginPath();
  ctx.ellipse(-8 * s, 2 * s, 10 * s, 4.8 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = near ? headColor : shade(headColor, -0.25);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30,20,15,0.4)';
  ctx.lineWidth = 1.1;
  ctx.stroke();
  if (near) {
    ctx.beginPath();
    ctx.ellipse(-8.5 * s, 2 * s, 7 * s, 2.4 * s, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e4a9a1';
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function headPath(breed: CowBreed): Path2D {
  const h = new Path2D();
  const dish = breed.dished ? 2.2 : 0;
  h.moveTo(-6, -12); // poll
  h.quadraticCurveTo(6, -14, 12, -11.5); // forehead
  h.quadraticCurveTo(22, -8 + dish, 32, -3); // bridge of the nose
  h.quadraticCurveTo(39, 1, 39, 6); // muzzle front
  h.quadraticCurveTo(38, 13, 31, 14); // lower lip / chin
  h.quadraticCurveTo(18, 15, 6, 14); // jaw
  h.quadraticCurveTo(-4, 13, -8, 4); // throat
  h.quadraticCurveTo(-11, -4, -6, -12);
  h.closePath();
  return h;
}

function drawHead(ctx: CanvasRenderingContext2D, breed: CowBreed, m: Markings, pose: CowPose): void {
  const hp = headPath(breed);
  const headColor =
    breed.head === 'white' || breed.head === 'whiteFace'
      ? (breed.marking ?? '#f6f1e6')
      : breed.head === 'dark'
        ? (breed.marking ?? breed.coat)
        : breed.coat;

  // Far ear and far horn sit behind the skull.
  drawHorns(ctx, breed, false);
  drawEar(ctx, breed, headColor, false, pose.ear);

  ctx.save();
  ctx.clip(hp);
  ctx.fillStyle = headColor;
  ctx.fill(hp);

  if (breed.head === 'whiteFace') {
    // Hereford: white face, but the coat colour wraps around the ears and poll.
    ctx.fillStyle = breed.coat;
    ctx.beginPath();
    ctx.ellipse(-6, -8, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (m.headBlaze) {
    ctx.fillStyle = breed.head === 'blaze' ? (breed.marking ?? '#fff') : '#f6f1e6';
    ctx.fill(m.headBlaze);
  }
  if (m.headStar) {
    ctx.fillStyle = '#f6f1e6';
    ctx.fill(m.headStar);
  }
  if (breed.shading) {
    const g = ctx.createRadialGradient(4, -6, 0, 4, -6, 26);
    g.addColorStop(0, rgba(breed.shading, 0.6));
    g.addColorStop(1, rgba(breed.shading, 0));
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, 100, 100);
  }

  // Muzzle. A pale "mealy" ring first for Jersey / Brown Swiss.
  if (breed.mealyMuzzle) {
    ctx.fillStyle = '#e9dcc4';
    ctx.beginPath();
    ctx.ellipse(31, 6, 12, 11, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = breed.muzzle;
  ctx.beginPath();
  ctx.ellipse(33.5, 6.5, 8, 8.5, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // nostril
  ctx.fillStyle = breed.nose;
  ctx.beginPath();
  ctx.ellipse(35, 4, 2.6, 1.8, -0.6, 0, Math.PI * 2);
  ctx.fill();
  // mouth
  ctx.strokeStyle = rgba(breed.nose, 0.9);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(37, 11 + pose.chew * 1.5);
  ctx.quadraticCurveTo(31, 12.5 + pose.chew * 2, 26, 11 + pose.chew * 0.5);
  ctx.stroke();

  // shading on the head
  const g = ctx.createLinearGradient(0, -14, 0, 16);
  g.addColorStop(0, 'rgba(255,255,255,0.12)');
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = g;
  ctx.fillRect(-40, -40, 100, 100);
  ctx.restore();

  outline(ctx, hp);

  // Eye: big, dark, with soft lid and lashes.
  const ex = 11;
  const ey = -3.5;
  const open = 1 - pose.blink;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ex, ey, 4.2, 3.4 * Math.max(0.08, open), -0.15, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#f2ece0';
  ctx.fillRect(ex - 6, ey - 6, 12, 12);
  ctx.fillStyle = breed.eye;
  ctx.beginPath();
  ctx.ellipse(ex + 0.3, ey, 3.1, 3.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(ex + 1.4, ey - 1.2, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // lid line / eyeliner (dark rims are very Jersey)
  ctx.strokeStyle = breed.shading ? '#2a1a12' : 'rgba(30,20,15,0.6)';
  ctx.lineWidth = breed.shading ? 1.4 : 1;
  ctx.beginPath();
  ctx.ellipse(ex, ey, 4.4, 3.5 * Math.max(0.08, open), -0.15, Math.PI, Math.PI * 2);
  ctx.stroke();
  // lashes
  if (breed.build === 'dairy' || breed.dished) {
    ctx.strokeStyle = 'rgba(30,20,15,0.7)';
    ctx.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) {
      const a = -2.2 + i * 0.5;
      ctx.beginPath();
      ctx.moveTo(ex + Math.cos(a) * 4.2, ey + Math.sin(a) * 3.4);
      ctx.lineTo(ex + Math.cos(a) * 6.6, ey + Math.sin(a) * 5.4);
      ctx.stroke();
    }
  }

  // Near ear and horn on top.
  drawEar(ctx, breed, headColor, true, pose.ear);
  drawHorns(ctx, breed, true);

  // Highland fringe: long hair hanging over the eyes.
  if (breed.fringe) {
    const rng = makeRng(77);
    for (let i = 0; i < 26; i++) {
      const x0 = -4 + rng() * 22;
      const len = 9 + rng() * 9;
      const sway = Math.sin(pose.t * 1.5 + i) * 0.6;
      ctx.strokeStyle = i % 3 === 0 ? shade(breed.coat, 0.18) : i % 3 === 1 ? shade(breed.coat, -0.2) : breed.coat;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0, -13 + rng() * 3);
      ctx.quadraticCurveTo(x0 + 3 + sway, -6 + rng() * 4, x0 + 1 + rng() * 5 + sway, -13 + len);
      ctx.stroke();
    }
  }
}

function legPath(kind: 'front' | 'hind', thick: number, len: number, bend: number): Path2D {
  const p = new Path2D();
  const w = 8 * thick;
  if (kind === 'front') {
    // Forearm from the shoulder to the knee, then the slimmer cannon bone to the hoof.
    p.moveTo(-w * 1.1, -56 * len);
    p.quadraticCurveTo(w * 1.3, -58 * len, w * 1.05, -36 * len);
    p.lineTo(w * 0.7 + bend, -26 * len); // knee
    p.lineTo(w * 0.6 + bend * 1.6, -2);
    p.lineTo(-w * 0.55 + bend * 1.6, -2);
    p.lineTo(-w * 0.6 + bend, -26 * len);
    p.lineTo(-w * 1.05, -40 * len);
    p.closePath();
  } else {
    // Heavy thigh, stifle forward, hock pointing back, cannon down to the hoof.
    p.moveTo(-w * 2.5, -60 * len);
    p.quadraticCurveTo(w * 1.6, -62 * len, w * 1.8, -42 * len); // front of thigh to stifle
    p.quadraticCurveTo(w * 1.3, -32 * len, w * 0.65 - bend, -24 * len); // gaskin down to hock front
    p.lineTo(w * 0.6 - bend * 1.8, -2);
    p.lineTo(-w * 0.6 - bend * 1.8, -2);
    p.lineTo(-w * 1.0 - bend, -24 * len); // hock point
    p.quadraticCurveTo(-w * 2.2, -36 * len, -w * 2.5, -50 * len);
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
  breed: CowBreed,
  m: Markings,
  p: Proportions,
  near: boolean,
): void {
  ctx.save();
  ctx.translate(x, pivotY);
  ctx.rotate(swing);
  ctx.translate(0, -pivotY);
  const bend = Math.max(0, kind === 'front' ? -swing : swing) * 10;
  const path = legPath(kind, p.legThick, p.legLen, bend);
  paintCoat(ctx, path, breed, m, { light: near ? 1 : 0.4, socksY: -25 });
  if (!near) {
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = 'rgba(20,12,8,0.28)';
    ctx.fillRect(-60, -80, 120, 100);
    ctx.restore();
  }
  outline(ctx, path, 1.1, near ? 0.3 : 0.2);
  // Hoof: cloven, dark.
  const hw = 6.2 * p.legThick;
  const hoof = new Path2D();
  hoof.moveTo(-hw + bend * 1.6, -6);
  hoof.lineTo(hw + bend * 1.6, -6);
  hoof.lineTo(hw + 1 + bend * 1.6, 0);
  hoof.lineTo(-hw - 1 + bend * 1.6, 0);
  hoof.closePath();
  ctx.fillStyle = near ? breed.hoof : shade(breed.hoof, -0.3);
  ctx.fill(hoof);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(bend * 1.6 + 0.5, -5);
  ctx.lineTo(bend * 1.6 + 0.5, 0);
  ctx.stroke();
  // knee / hock joint hint
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-3 + bend, -25 * p.legLen);
  ctx.lineTo(3 + bend, -25 * p.legLen);
  ctx.stroke();
  ctx.restore();
}

function drawUdder(ctx: CanvasRenderingContext2D, breed: CowBreed): void {
  if (breed.udder < 0.3) return;
  const u = breed.udder;
  const path = new Path2D();
  path.moveTo(-46, -30);
  path.quadraticCurveTo(-48, -20 + 9 * u, -30, -19 + 10 * u);
  path.quadraticCurveTo(-12, -18 + 9 * u, -6, -27);
  path.closePath();
  ctx.fillStyle = '#e9b6ab';
  ctx.fill(path);
  ctx.save();
  ctx.clip(path);
  const g = ctx.createLinearGradient(0, -30, 0, -8);
  g.addColorStop(0, 'rgba(255,255,255,0.15)');
  g.addColorStop(1, 'rgba(120,40,40,0.35)');
  ctx.fillStyle = g;
  ctx.fillRect(-60, -30, 80, 60);
  ctx.restore();
  ctx.strokeStyle = 'rgba(120,50,50,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke(path);
  // teats
  ctx.fillStyle = '#dea095';
  for (const tx of [-36, -22]) {
    ctx.beginPath();
    ctx.ellipse(tx, -19 + 10 * u, 1.7, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTail(ctx: CanvasRenderingContext2D, breed: CowBreed, pose: CowPose, d: number): void {
  const swish = pose.tail * 10 + Math.sin(pose.t * 1.3) * 2;
  const tailColor = shade(breed.coat, -0.12);
  ctx.strokeStyle = tailColor;
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-63, -60 * d);
  ctx.quadraticCurveTo(-68 + swish * 0.4, -46, -64 + swish, -30);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(30,20,15,0.3)';
  ctx.lineWidth = 4.2;
  ctx.globalAlpha = 0.5;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // switch (the tuft)
  const sw = new Path2D();
  const sx = -64 + swish;
  sw.moveTo(sx - 3, -32);
  sw.quadraticCurveTo(sx - 8 + swish * 0.3, -22, sx - 4 + swish * 0.6, -12);
  sw.quadraticCurveTo(sx + 1 + swish * 0.6, -8, sx + 5 + swish * 0.6, -13);
  sw.quadraticCurveTo(sx + 6, -22, sx + 3, -32);
  sw.closePath();
  const switchColor = breed.whiteSwitch ? '#f3eee2' : breed.marking && breed.pattern === 'patches' ? breed.marking : shade(breed.coat, -0.35);
  ctx.fillStyle = switchColor;
  ctx.fill(sw);
  outline(ctx, sw, 1);
}

/** Long hair hanging from the belly line and dewlap for shaggy breeds. */
function drawShag(ctx: CanvasRenderingContext2D, breed: CowBreed, a: Anatomy, pose: CowPose, density: number): void {
  const rng = makeRng(31);
  const colors = [breed.coat, shade(breed.coat, -0.22), shade(breed.coat, 0.15)];
  ctx.lineCap = 'round';
  const segs = a.bellyCurve;
  for (const [p0, p1, p2, p3] of segs) {
    for (let t = 0.05; t < 1; t += 1 / density) {
      const pt = cubicPoint(p0, p1, p2, p3, t);
      if (pt.x > 44) continue; // don't drown the brisket
      const len = breed.horns === 'highland' ? 7 + rng() * 9 : 4 + rng() * 4;
      const sway = Math.sin(pose.t * 2 + pt.x * 0.1) * 1.2;
      ctx.strokeStyle = colors[Math.floor(rng() * colors.length)];
      ctx.lineWidth = 1.5 + rng();
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y - 3);
      ctx.quadraticCurveTo(pt.x + (rng() - 0.5) * 4 + sway, pt.y + len * 0.6, pt.x + (rng() - 0.5) * 6 + sway, pt.y + len);
      ctx.stroke();
    }
  }
  // Fluffy top line.
  for (const [p0, p1, p2, p3] of a.topCurve) {
    for (let t = 0.05; t < 1; t += 1 / (density * 0.7)) {
      const pt = cubicPoint(p0, p1, p2, p3, t);
      ctx.strokeStyle = colors[Math.floor(rng() * colors.length)];
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y + 2);
      ctx.quadraticCurveTo(pt.x - 2 + rng() * 2, pt.y - 3, pt.x - 4 + rng() * 5, pt.y - 5 - rng() * 3);
      ctx.stroke();
    }
  }
}

/** A drop shadow on the ground under the animal. */
export function drawGroundShadow(ctx: CanvasRenderingContext2D, w: number, alpha = 0.22): void {
  ctx.fillStyle = `rgba(20,30,10,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(0, 1, w, w * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws a cow with the current transform's origin under its belly at ground level.
 * The cow faces +x; flip the context to face left.
 */
export function drawCow(ctx: CanvasRenderingContext2D, breed: CowBreed, seed: number, pose: CowPose): void {
  const m = buildMarkings(breed, seed);
  const p = proportions(breed);
  const a = buildAnatomy(p, pose);
  const d = p.bodyDepth;

  ctx.save();
  ctx.scale(breed.size * m.sizeJitter, breed.size * m.sizeJitter);
  const bob = Math.sin(pose.walk * 2) * 1.2 * pose.moving;
  ctx.translate(0, bob);

  const amp = 0.32 * pose.moving;
  const swing = (ph: number) => Math.sin(pose.walk + ph) * amp;

  // Far legs first, shifted slightly to fake depth.
  drawLeg(ctx, 'hind', -46 + 7, -58 * d, swing(Math.PI + 0.4), breed, m, p, false);
  drawLeg(ctx, 'front', 30 + 7, -56 * d, swing(Math.PI), breed, m, p, false);

  drawTail(ctx, breed, pose, d);

  // Body barrel and neck.
  paintCoat(ctx, a.body, breed, m, { light: 1 });
  drawUdder(ctx, breed);
  paintCoat(ctx, a.neck, breed, m, { light: 1 });
  if (breed.head === 'whiteFace' || breed.head === 'dark') {
    // Colour carries down the throat / crest from the head onto the neck.
    ctx.save();
    ctx.clip(a.neck);
    ctx.translate(a.junction.x, a.junction.y);
    ctx.rotate(a.headAngle);
    ctx.fillStyle = breed.head === 'whiteFace' ? (breed.marking ?? '#f6f1e6') : (breed.marking ?? breed.coat);
    ctx.beginPath();
    ctx.ellipse(-12, 8, 18, 9, 0.3, 0, Math.PI * 2);
    ctx.fill();
    if (breed.head === 'whiteFace') {
      ctx.beginPath();
      ctx.ellipse(-16, -12, 16, 4, 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  outline(ctx, a.body);
  outline(ctx, a.neck, 1.1);

  // Near legs over the body.
  drawLeg(ctx, 'hind', -46, -58 * d, swing(0.4), breed, m, p, true);
  drawLeg(ctx, 'front', 30, -56 * d, swing(0), breed, m, p, true);

  if (breed.shaggy) drawShag(ctx, breed, a, pose, 26);

  // Head.
  ctx.save();
  ctx.translate(a.junction.x, a.junction.y);
  ctx.rotate(a.headAngle + Math.sin(pose.t * 0.9) * 0.02);
  drawHead(ctx, breed, m, pose);
  ctx.restore();

  ctx.restore();
}

/** Rough horizontal extent (in unscaled units) used for hit tests and shadows. */
export const COW_EXTENT = { left: -74, right: 110, top: -80 };

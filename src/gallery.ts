/**
 * Design gallery: renders every breed of a species large on one canvas.
 * Open the game with ?gallery=cows|horses|dogs|small|birds|people|all.
 * Used by the screenshot script to check the artwork.
 */
import { COW_BREEDS } from './game/breeds/cowBreeds';
import {
  CHICKEN_BREEDS,
  DOG_BREEDS,
  DUCK_BREEDS,
  FARMERS,
  GOAT_BREEDS,
  HORSE_BREEDS,
  PIG_BREEDS,
  SHEEP_BREEDS,
  TRACTORS,
} from './game/breeds/otherBreeds';
import { drawCow, drawGroundShadow } from './game/art/cowArt';
import { drawHorse } from './game/art/horseArt';
import { drawDog } from './game/art/dogArt';
import { drawGoat, drawPig, drawSheep } from './game/art/smallAnimalArt';
import { drawChicken, drawDuck } from './game/art/birdArt';
import { drawFarmer } from './game/art/peopleArt';
import { drawTractor } from './game/art/tractorArt';
import { IDLE_POSE, type Pose } from './game/art/common';

interface Cell {
  label: string;
  scale: number;
  draw: (ctx: CanvasRenderingContext2D, pose: Pose) => void;
}

function cells(which: string): Cell[] {
  const out: Cell[] = [];
  const add = <T extends { name: string }>(list: T[], scale: number, fn: (ctx: CanvasRenderingContext2D, b: T, seed: number, pose: Pose) => void) =>
    list.forEach((b, i) => out.push({ label: b.name, scale, draw: (ctx, pose) => fn(ctx, b, 1234 + i * 17, pose) }));
  if (which === 'cows' || which === 'all') add(COW_BREEDS, 1.25, (c, b, s, p) => drawCow(c, b, s, p));
  if (which === 'horses' || which === 'all') add(HORSE_BREEDS, 1.05, drawHorse);
  if (which === 'dogs' || which === 'all') add(DOG_BREEDS, 2, drawDog);
  if (which === 'small' || which === 'all') {
    add(PIG_BREEDS, 2, drawPig);
    add(SHEEP_BREEDS, 2, drawSheep);
    add(GOAT_BREEDS, 1.8, drawGoat);
  }
  if (which === 'birds' || which === 'all') {
    add(CHICKEN_BREEDS, 3, drawChicken);
    add(DUCK_BREEDS, 3, (c, b, s, p) => drawDuck(c, b, s, p));
  }
  if (which === 'people' || which === 'all') {
    add(FARMERS, 1.4, drawFarmer);
    add(TRACTORS, 1, drawTractor);
  }
  return out;
}

export function renderGallery(canvas: HTMLCanvasElement, which: string, t = 0): void {
  const list = cells(which);
  const cols = 4;
  const cellW = 300;
  const cellH = 210;
  const rows = Math.ceil(list.length / cols);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = cols * cellW * dpr;
  canvas.height = rows * cellH * dpr;
  canvas.style.width = `${cols * cellW}px`;
  canvas.style.height = `${rows * cellH}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#9ccc65';
  ctx.fillRect(0, 0, cols * cellW, rows * cellH);

  list.forEach((cell, i) => {
    const cx = (i % cols) * cellW + cellW / 2;
    const cy = Math.floor(i / cols) * cellH + cellH - 40;
    const pose: Pose = { ...IDLE_POSE, headDown: i % 5 === 2 ? 0.9 : 0, t };
    ctx.save();
    ctx.translate(cx - 10, cy);
    ctx.scale(cell.scale, cell.scale);
    drawGroundShadow(ctx, 70 / cell.scale + 10);
    cell.draw(ctx, pose);
    ctx.restore();
    ctx.fillStyle = '#243';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cell.label, cx, cy + 30);
  });
}

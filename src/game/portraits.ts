/** Renders and caches a circular portrait for each character (used by HUD and album). */
import { IDLE_POSE } from './art/common';
import type { CharacterDef } from './characters';

const cache = new Map<string, HTMLCanvasElement>();
const SIZE = 96;

export function portraitOf(def: CharacterDef): HTMLCanvasElement {
  const c = cache.get(def.id);
  if (c) return c;
  // Draw once at a known scale to find the bounding box, then fit into the circle.
  const probe = document.createElement('canvas');
  probe.width = 512;
  probe.height = 512;
  const pctx = probe.getContext('2d')!;
  pctx.translate(256, 420);
  def.draw(pctx, { ...IDLE_POSE, t: 1 }, false);
  const img = pctx.getImageData(0, 0, 512, 512).data;
  let minX = 512;
  let minY = 512;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < 512; y += 2) {
    for (let x = 0; x < 512; x += 2) {
      if (img[(y * 512 + x) * 4 + 3] > 40) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  const fit = (SIZE * 0.78) / Math.max(w, h);
  const out = document.createElement('canvas');
  out.width = SIZE;
  out.height = SIZE;
  const octx = out.getContext('2d')!;
  octx.translate(SIZE / 2, SIZE / 2);
  octx.scale(fit, fit);
  octx.translate(-(minX + w / 2 - 256), -(minY + h / 2 - 420));
  def.draw(octx, { ...IDLE_POSE, t: 1 }, false);
  cache.set(def.id, out);
  return out;
}

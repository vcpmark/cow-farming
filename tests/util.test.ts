import { describe, expect, it } from 'vitest';
import { clamp, hashString, hexToRgb, lerp, makeRng, mixColor, rgbToHex, shade } from '../src/game/util';

describe('util', () => {
  it('seeded rng is deterministic and in range', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(makeRng(1)()).not.toBe(makeRng(2)());
  });

  it('hashes strings stably', () => {
    expect(hashString('holstein')).toBe(hashString('holstein'));
    expect(hashString('holstein')).not.toBe(hashString('jersey'));
  });

  it('converts colours', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(rgbToHex(255, 128, 0)).toBe('#ff8000');
    expect(shade('#808080', 0)).toBe('#808080');
    expect(shade('#808080', 1)).toBe('#ffffff');
    expect(shade('#808080', -1)).toBe('#000000');
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('clamps and lerps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
  });
});

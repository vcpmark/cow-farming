import { describe, expect, it } from 'vitest';
import { lapPoint, rankScores, ribbonFor, totalScore } from '../src/game/show';
import { RING, inRing } from '../src/game/world';

describe('cow show scoring', () => {
  it('combines grooming, leading and set-up into 0..100 points', () => {
    expect(totalScore(0, 0, 0)).toBe(0);
    expect(totalScore(1, 1, 1)).toBe(100);
    expect(totalScore(1, 0, 0)).toBe(35);
    expect(totalScore(0, 0, 1)).toBe(30);
    expect(totalScore(2, -1, 0.5)).toBe(50); // clamped
  });

  it('ranks scores with ties broken by order', () => {
    expect(rankScores([80, 95, 60, 80])).toEqual([2, 1, 4, 3]);
  });

  it('awards Grand Champion only to a first place with a great score', () => {
    expect(ribbonFor(1, 92)).toBe('champion');
    expect(ribbonFor(1, 70)).toBe('blue');
    expect(ribbonFor(2, 99)).toBe('red');
    expect(ribbonFor(3, 50)).toBe('yellow');
    expect(ribbonFor(4, 10)).toBe('white');
  });

  it('keeps the judged lap inside the ring', () => {
    for (let u = 0; u < 1; u += 0.05) {
      const p = lapPoint(u);
      expect(inRing(p.x, p.y), `u=${u}`).toBe(true);
      expect(p.x).toBeGreaterThan(RING.x0 + 20);
      expect(p.x).toBeLessThan(RING.x1 - 20);
    }
  });
});

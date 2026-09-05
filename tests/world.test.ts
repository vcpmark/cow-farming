import { describe, expect, it } from 'vitest';
import { AREAS, DAY_LENGTH, GROUND_BOTTOM, GROUND_TOP, POND, WORLD_WIDTH, daylight, depthScale, inMud, inPond } from '../src/game/world';

describe('world', () => {
  it('areas tile the farm without overlapping and stay inside the world', () => {
    for (let i = 0; i < AREAS.length; i++) {
      const a = AREAS[i];
      expect(a.x1).toBeGreaterThan(a.x0);
      expect(a.x1).toBeLessThanOrEqual(WORLD_WIDTH);
      if (i > 0) expect(a.x0).toBeGreaterThanOrEqual(AREAS[i - 1].x1);
    }
  });

  it('scales characters up as they come closer to the camera', () => {
    expect(depthScale(GROUND_TOP)).toBeLessThan(depthScale(GROUND_BOTTOM));
  });

  it('knows where the pond and the mud are', () => {
    expect(inPond(POND.x, POND.y)).toBe(true);
    expect(inPond(POND.x + POND.rx * 2, POND.y)).toBe(false);
    expect(inMud(2820, 360)).toBe(true);
    expect(inMud(100, 360)).toBe(false);
  });

  it('cycles through day and night', () => {
    const noon = daylight(DAY_LENGTH * 0.3);
    const midnight = daylight(DAY_LENGTH * 0.8);
    expect(noon.light).toBe(1);
    expect(noon.isNight).toBe(false);
    expect(midnight.light).toBe(0);
    expect(midnight.isNight).toBe(true);
    // wraps around
    expect(daylight(DAY_LENGTH * 1.3).light).toBe(noon.light);
    for (const t of [0, 0.1, 0.5, 0.62, 0.66, 0.9, 0.99]) {
      const d = daylight(DAY_LENGTH * t);
      expect(d.skyTop).toMatch(/^#[0-9a-f]{6}$/);
      expect(d.light).toBeGreaterThanOrEqual(0);
      expect(d.light).toBeLessThanOrEqual(1);
    }
  });
});

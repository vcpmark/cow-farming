import { describe, expect, it } from 'vitest';
import { buildCharacters, type Species } from '../src/game/characters';
import { WORLD_WIDTH } from '../src/game/world';

describe('characters', () => {
  const chars = buildCharacters();

  it('includes every species and every cow breed', () => {
    const species = new Set(chars.map((c) => c.species));
    const expected: Species[] = ['cow', 'horse', 'dog', 'pig', 'sheep', 'goat', 'chicken', 'duck', 'farmer', 'tractor'];
    for (const s of expected) expect(species.has(s), s).toBe(true);
    expect(chars.filter((c) => c.species === 'cow')).toHaveLength(12);
  });

  it('has unique ids and kid friendly words', () => {
    expect(new Set(chars.map((c) => c.id)).size).toBe(chars.length);
    for (const c of chars) {
      expect(c.word.length).toBeGreaterThan(1);
      expect(c.speed).toBeGreaterThan(0);
      expect(typeof c.draw).toBe('function');
    }
  });

  it('keeps every home range inside the world', () => {
    for (const c of chars) {
      expect(c.home[0]).toBeGreaterThanOrEqual(0);
      expect(c.home[1]).toBeLessThanOrEqual(WORLD_WIDTH);
      expect(c.home[1]).toBeGreaterThan(c.home[0]);
    }
  });

  it('only ducks swim and only grass eaters graze', () => {
    for (const c of chars) {
      if (c.swims) expect(c.species).toBe('duck');
      if (c.grazes) expect(['cow', 'horse', 'sheep', 'goat', 'chicken']).toContain(c.species);
    }
  });
});

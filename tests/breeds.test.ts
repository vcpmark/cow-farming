import { describe, expect, it } from 'vitest';
import { COW_BREEDS, cowBreedById } from '../src/game/breeds/cowBreeds';
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
} from '../src/game/breeds/otherBreeds';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

describe('cow breeds', () => {
  it('has twelve real breeds with unique ids', () => {
    expect(COW_BREEDS).toHaveLength(12);
    const ids = new Set(COW_BREEDS.map((b) => b.id));
    expect(ids.size).toBe(COW_BREEDS.length);
  });

  it('uses valid colours everywhere', () => {
    for (const b of COW_BREEDS) {
      for (const c of [b.coat, b.muzzle, b.nose, b.hornColor, b.hoof, b.eye, b.marking, b.shading]) {
        if (c !== undefined) expect(c, `${b.id}`).toMatch(HEX);
      }
    }
  });

  it('gives every breed a kid friendly fact and an origin', () => {
    for (const b of COW_BREEDS) {
      expect(b.fact.length).toBeGreaterThan(30);
      expect(b.origin.length).toBeGreaterThan(2);
    }
  });

  it('matches well known breed traits', () => {
    expect(cowBreedById('holstein').pattern).toBe('patches');
    expect(cowBreedById('holstein').marking).toBe('#1c1a1a');
    expect(cowBreedById('angus').horns).toBe('none');
    expect(cowBreedById('hereford').head).toBe('whiteFace');
    expect(cowBreedById('highland').shaggy).toBe(true);
    expect(cowBreedById('highland').horns).toBe('highland');
    expect(cowBreedById('galloway').pattern).toBe('belt');
    expect(cowBreedById('longhorn').horns).toBe('longhorn');
    expect(cowBreedById('jersey').mealyMuzzle).toBe(true);
    expect(cowBreedById('jersey').dished).toBe(true);
    expect(cowBreedById('brownswiss').ears).toBeGreaterThan(1);
  });

  it('gives dairy breeds a prominent udder and beef breeds a small one', () => {
    for (const b of COW_BREEDS) {
      if (b.build === 'dairy') expect(b.udder, b.id).toBeGreaterThanOrEqual(0.8);
      if (b.build === 'beef') expect(b.udder, b.id).toBeLessThanOrEqual(0.4);
    }
  });

  it('throws for unknown breeds', () => {
    expect(() => cowBreedById('unicorn')).toThrow();
  });
});

describe('other breeds', () => {
  const lists: [string, { id: string; name: string; fact: string; size: number }[]][] = [
    ['horses', HORSE_BREEDS],
    ['dogs', DOG_BREEDS],
    ['pigs', PIG_BREEDS],
    ['sheep', SHEEP_BREEDS],
    ['goats', GOAT_BREEDS],
    ['chickens', CHICKEN_BREEDS],
    ['ducks', DUCK_BREEDS],
    ['farmers', FARMERS],
    ['tractors', TRACTORS],
  ];
  for (const [label, list] of lists) {
    it(`${label} have unique ids, names, facts and sane sizes`, () => {
      expect(list.length).toBeGreaterThan(1);
      expect(new Set(list.map((b) => b.id)).size).toBe(list.length);
      for (const b of list) {
        expect(b.name.length).toBeGreaterThan(2);
        expect(b.fact.length).toBeGreaterThan(20);
        expect(b.size).toBeGreaterThan(0.4);
        expect(b.size).toBeLessThan(1.5);
      }
    });
  }
});

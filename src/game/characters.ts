/**
 * Every playable character on the farm: animals, farmers and tractors.
 * The player can tap any of them to become them.
 */
import { COW_BREEDS, COW_NAMES, type CowBreed } from './breeds/cowBreeds';
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
  type ChickenBreed,
  type DogBreed,
  type DuckBreed,
  type FarmerSpec,
  type GoatBreed,
  type HorseBreed,
  type PigBreed,
  type SheepBreed,
  type TractorSpec,
} from './breeds/otherBreeds';
import { drawCow } from './art/cowArt';
import { drawHorse } from './art/horseArt';
import { drawDog } from './art/dogArt';
import { drawGoat, drawPig, drawSheep } from './art/smallAnimalArt';
import { drawChicken, drawDuck } from './art/birdArt';
import { drawFarmer } from './art/peopleArt';
import { drawTractor } from './art/tractorArt';
import type { Pose } from './art/common';
import { hashString } from './util';

export type Species = 'cow' | 'horse' | 'dog' | 'pig' | 'sheep' | 'goat' | 'chicken' | 'duck' | 'farmer' | 'tractor';

export type SoundKind = 'moo' | 'neigh' | 'woof' | 'oink' | 'baa' | 'maa' | 'cluck' | 'quack' | 'hello' | 'horn';

export interface CharacterDef {
  id: string;
  species: Species;
  /** Individual name, e.g. "Daisy". */
  name: string;
  /** Breed or model, e.g. "Holstein Friesian". */
  breed: string;
  fact: string;
  /** The word shown in the speech bubble. */
  word: string;
  sound: SoundKind;
  /** Movement speed in world units per second. */
  speed: number;
  /** Where the character likes to wander when not controlled. */
  home: [number, number];
  /** Display scale applied on top of the breed's own size. */
  scale: number;
  /** Half-width and height used for tap hit-testing, in unscaled units. */
  hit: { w: number; h: number };
  /** Grazes (lowers head to eat grass). */
  grazes?: boolean;
  /** Swims when standing in the pond. */
  swims?: boolean;
  seed: number;
  draw: (ctx: CanvasRenderingContext2D, pose: Pose, swimming: boolean) => void;
}

const HORSE_NAMES = ['Thunder', 'Biscuit', 'Storm', 'Peanut', 'Midnight', 'Pippin'];
const DOG_NAMES = ['Scout', 'Sunny', 'Blue', 'Copper', 'Bruno', 'Pip'];
const PIG_NAMES = ['Wilbur', 'Truffle', 'Petunia', 'Bacon-Bit'];
const SHEEP_NAMES = ['Shaun', 'Dolly', 'Patches'];
const GOAT_NAMES = ['Gus', 'Heidi', 'Pepper'];
const CHICKEN_NAMES = ['Henrietta', 'Roger', 'Pebbles', 'Fluffy'];
const DUCK_NAMES = ['Donald', 'Puddle', 'Dash'];

function seedOf(id: string): number {
  return hashString(id);
}

export function buildCharacters(): CharacterDef[] {
  const out: CharacterDef[] = [];

  FARMERS.forEach((f: FarmerSpec, i) => {
    out.push({
      id: `farmer-${f.id}`,
      species: 'farmer',
      name: f.name,
      breed: f.kid ? 'Farm kid' : 'Farmer',
      fact: f.fact,
      word: f.kid ? 'Hi!' : 'Howdy!',
      sound: 'hello',
      speed: f.kid ? 120 : 110,
      home: [120 + i * 160, 700],
      scale: 1,
      hit: { w: 16, h: 90 },
      seed: seedOf(f.id),
      draw: (ctx, pose) => drawFarmer(ctx, f, seedOf(f.id), pose),
    });
  });

  COW_BREEDS.forEach((b: CowBreed, i) => {
    const name = COW_NAMES[i % COW_NAMES.length];
    out.push({
      id: `cow-${b.id}`,
      species: 'cow',
      name,
      breed: b.name,
      fact: b.fact,
      word: 'Moo!',
      sound: 'moo',
      speed: 70,
      home: [600, 1820],
      scale: 0.72,
      hit: { w: 90, h: 100 },
      grazes: true,
      seed: seedOf(b.id + name),
      draw: (ctx, pose) => drawCow(ctx, b, seedOf(b.id + name), pose),
    });
  });

  HORSE_BREEDS.forEach((b: HorseBreed, i) => {
    out.push({
      id: `horse-${b.id}`,
      species: 'horse',
      name: HORSE_NAMES[i % HORSE_NAMES.length],
      breed: b.name,
      fact: b.fact,
      word: 'Neigh!',
      sound: 'neigh',
      speed: 150,
      home: [3520, 4120],
      scale: 0.66,
      hit: { w: 80, h: 130 },
      grazes: true,
      seed: seedOf(b.id),
      draw: (ctx, pose) => drawHorse(ctx, b, seedOf(b.id), pose),
    });
  });

  DOG_BREEDS.forEach((b: DogBreed, i) => {
    out.push({
      id: `dog-${b.id}`,
      species: 'dog',
      name: DOG_NAMES[i % DOG_NAMES.length],
      breed: b.name,
      fact: b.fact,
      word: 'Woof!',
      sound: 'woof',
      speed: 170,
      home: i < 3 ? [150, 1800] : [2950, 3500],
      scale: 0.9,
      hit: { w: 45, h: 60 },
      seed: seedOf(b.id),
      draw: (ctx, pose) => drawDog(ctx, b, seedOf(b.id), pose),
    });
  });

  PIG_BREEDS.forEach((b: PigBreed, i) => {
    out.push({
      id: `pig-${b.id}`,
      species: 'pig',
      name: PIG_NAMES[i % PIG_NAMES.length],
      breed: b.name,
      fact: b.fact,
      word: 'Oink!',
      sound: 'oink',
      speed: 90,
      home: [2700, 2940],
      scale: 0.85,
      hit: { w: 45, h: 50 },
      seed: seedOf(b.id),
      draw: (ctx, pose) => drawPig(ctx, b, seedOf(b.id), pose),
    });
  });

  SHEEP_BREEDS.forEach((b: SheepBreed, i) => {
    out.push({
      id: `sheep-${b.id}`,
      species: 'sheep',
      name: SHEEP_NAMES[i % SHEEP_NAMES.length],
      breed: b.name,
      fact: b.fact,
      word: 'Baa!',
      sound: 'baa',
      speed: 95,
      home: [2980, 3460],
      scale: 0.9,
      hit: { w: 42, h: 55 },
      grazes: true,
      seed: seedOf(b.id),
      draw: (ctx, pose) => drawSheep(ctx, b, seedOf(b.id), pose),
    });
  });

  GOAT_BREEDS.forEach((b: GoatBreed, i) => {
    out.push({
      id: `goat-${b.id}`,
      species: 'goat',
      name: GOAT_NAMES[i % GOAT_NAMES.length],
      breed: b.name,
      fact: b.fact,
      word: 'Maa!',
      sound: 'maa',
      speed: 120,
      home: [2980, 3460],
      scale: 0.9,
      hit: { w: 42, h: 70 },
      grazes: true,
      seed: seedOf(b.id),
      draw: (ctx, pose) => drawGoat(ctx, b, seedOf(b.id), pose),
    });
  });

  CHICKEN_BREEDS.forEach((b: ChickenBreed, i) => {
    out.push({
      id: `chicken-${b.id}`,
      species: 'chicken',
      name: CHICKEN_NAMES[i % CHICKEN_NAMES.length],
      breed: b.name,
      fact: b.fact,
      word: b.rooster ? 'Cock-a-doodle-doo!' : 'Bawk!',
      sound: 'cluck',
      speed: 100,
      home: [2350, 2660],
      scale: 1.3,
      hit: { w: 24, h: 45 },
      grazes: true,
      seed: seedOf(b.id),
      draw: (ctx, pose) => drawChicken(ctx, b, seedOf(b.id), pose),
    });
  });

  DUCK_BREEDS.forEach((b: DuckBreed, i) => {
    out.push({
      id: `duck-${b.id}`,
      species: 'duck',
      name: DUCK_NAMES[i % DUCK_NAMES.length],
      breed: b.name,
      fact: b.fact,
      word: 'Quack!',
      sound: 'quack',
      speed: 85,
      home: [1880, 2300],
      scale: 1.2,
      hit: { w: 26, h: 42 },
      swims: true,
      seed: seedOf(b.id),
      draw: (ctx, pose, swimming) => drawDuck(ctx, b, seedOf(b.id), pose, swimming),
    });
  });

  TRACTORS.forEach((t: TractorSpec) => {
    out.push({
      id: `tractor-${t.id}`,
      species: 'tractor',
      name: t.name,
      breed: 'Tractor',
      fact: t.fact,
      word: 'Toot toot!',
      sound: 'horn',
      speed: 190,
      home: [4160, 4740],
      scale: 0.72,
      hit: { w: 70, h: 100 },
      seed: seedOf(t.id),
      draw: (ctx, pose) => drawTractor(ctx, t, seedOf(t.id), pose),
    });
  });

  return out;
}

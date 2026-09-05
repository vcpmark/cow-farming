/**
 * Real cattle breeds, described accurately enough that the procedural art
 * renders each one recognisably. Colours are picked from reference photos.
 */

export type HornStyle = 'none' | 'short' | 'curvedDown' | 'lyre' | 'longhorn' | 'highland';
export type CowBuild = 'dairy' | 'beef' | 'lean';
export type HeadPattern = 'coat' | 'white' | 'blaze' | 'dark' | 'whiteFace';

/** A patch anchor in cow body space. x runs from rump (0) to chest (1), y from back (0) to belly (1). */
export interface PatchAnchor {
  x: number;
  y: number;
  r: number;
  ry?: number;
  /** How much each individual animal may move this patch (0..1). */
  jitter?: number;
}

export interface CowBreed {
  id: string;
  name: string;
  origin: string;
  /** A short fun fact, read aloud to the player when they become this cow. */
  fact: string;
  /** Base coat colour. */
  coat: string;
  /** Colour of the markings (patches, belt, speckles). */
  marking?: string;
  pattern: 'solid' | 'patches' | 'belt' | 'speckle' | 'roan';
  patches?: PatchAnchor[];
  /** Number of small speckles for speckled breeds. */
  speckles?: number;
  head: HeadPattern;
  /** Lower legs white (Hereford, Holstein, Guernsey ...). */
  whiteSocks?: boolean;
  whiteBelly?: boolean;
  whiteSwitch?: boolean;
  /** Pale ring around the muzzle (Jersey, Brown Swiss). */
  mealyMuzzle?: boolean;
  muzzle: string;
  nose: string;
  horns: HornStyle;
  hornColor: string;
  hoof: string;
  build: CowBuild;
  /** Overall scale relative to a standard cow. */
  size: number;
  /** Udder prominence, 0..1. */
  udder: number;
  /** Long shaggy coat (Highland, Galloway). */
  shaggy?: boolean;
  /** Long fringe over the eyes (Highland). */
  fringe?: boolean;
  /** Dished, concave face like a Jersey. */
  dished?: boolean;
  /** Ear scale. Brown Swiss ears are big; Highland ears hide in hair. */
  ears?: number;
  /** Shading colour used on the neck/shoulders/hips for breeds that darken there (Jersey). */
  shading?: string;
  eye: string;
}

export const COW_BREEDS: CowBreed[] = [
  {
    id: 'holstein',
    name: 'Holstein Friesian',
    origin: 'Netherlands',
    fact: 'Holsteins are the black-and-white cows you see on milk cartons. Every Holstein has a different pattern of spots, like a fingerprint!',
    coat: '#f7f4ee',
    marking: '#1c1a1a',
    pattern: 'patches',
    patches: [
      { x: 0.8, y: 0.35, r: 0.26, ry: 0.4, jitter: 0.5 },
      { x: 0.45, y: 0.28, r: 0.17, ry: 0.3, jitter: 0.7 },
      { x: 0.14, y: 0.4, r: 0.22, ry: 0.4, jitter: 0.5 },
    ],
    head: 'dark',
    whiteSocks: true,
    whiteBelly: true,
    whiteSwitch: true,
    muzzle: '#2b2626',
    nose: '#1a1616',
    horns: 'none',
    hornColor: '#c9b89a',
    hoof: '#2a2422',
    build: 'dairy',
    size: 1.05,
    udder: 1,
    eye: '#2a1d14',
  },
  {
    id: 'jersey',
    name: 'Jersey',
    origin: 'Jersey, Channel Islands',
    fact: 'Jersey cows are small and gentle with big dark eyes and long eyelashes. Their milk is extra creamy and golden!',
    coat: '#c7935a',
    shading: '#7a4a2a',
    pattern: 'solid',
    head: 'coat',
    mealyMuzzle: true,
    muzzle: '#2a211c',
    nose: '#1a1412',
    horns: 'none',
    hornColor: '#d8c7a8',
    hoof: '#2a2422',
    build: 'dairy',
    size: 0.88,
    udder: 0.9,
    dished: true,
    eye: '#1a120c',
  },
  {
    id: 'angus',
    name: 'Aberdeen Angus',
    origin: 'Scotland',
    fact: 'Angus cattle are all black and have no horns at all. They are strong, calm and love to munch grass all day.',
    coat: '#181616',
    pattern: 'solid',
    head: 'coat',
    muzzle: '#121010',
    nose: '#0c0a0a',
    horns: 'none',
    hornColor: '#000',
    hoof: '#151212',
    build: 'beef',
    size: 1,
    udder: 0.2,
    eye: '#0a0806',
  },
  {
    id: 'hereford',
    name: 'Hereford',
    origin: 'England',
    fact: 'Herefords have a rusty red coat with a bright white face, white chest and white socks. Farmers call them "white faces".',
    coat: '#9a3f24',
    marking: '#f6f1e6',
    pattern: 'solid',
    head: 'whiteFace',
    whiteSocks: true,
    whiteBelly: true,
    whiteSwitch: true,
    muzzle: '#e8b7a6',
    nose: '#d99a8a',
    horns: 'curvedDown',
    hornColor: '#e6d8bd',
    hoof: '#4a3a30',
    build: 'beef',
    size: 1,
    udder: 0.25,
    eye: '#2a1d14',
  },
  {
    id: 'highland',
    name: 'Highland',
    origin: 'Scottish Highlands',
    fact: 'Highland cows have long shaggy ginger hair and huge horns. Their fluffy fringe keeps rain and snow out of their eyes.',
    coat: '#b8642a',
    pattern: 'solid',
    head: 'coat',
    muzzle: '#6b4a3a',
    nose: '#3a2a22',
    horns: 'highland',
    hornColor: '#e2d3b5',
    hoof: '#2e2420',
    build: 'beef',
    size: 0.92,
    udder: 0.15,
    shaggy: true,
    fringe: true,
    ears: 0.7,
    eye: '#1a120c',
  },
  {
    id: 'brownswiss',
    name: 'Brown Swiss',
    origin: 'Switzerland',
    fact: 'Brown Swiss cows are big, gentle mountain cows with huge fuzzy ears and a pale, powdery nose. In the Alps they wear big bells!',
    coat: '#8a7a6a',
    shading: '#5a4c40',
    pattern: 'solid',
    head: 'coat',
    mealyMuzzle: true,
    muzzle: '#2b2624',
    nose: '#1c1816',
    horns: 'short',
    hornColor: '#d6c8b0',
    hoof: '#2a2422',
    build: 'dairy',
    size: 1.08,
    udder: 0.85,
    ears: 1.35,
    eye: '#1a120c',
  },
  {
    id: 'guernsey',
    name: 'Guernsey',
    origin: 'Guernsey, Channel Islands',
    fact: 'Guernsey cows are golden-brown and white. Their milk is so yellow it is called "Golden Guernsey" milk!',
    coat: '#d19a4e',
    marking: '#faf6ec',
    pattern: 'patches',
    patches: [
      { x: 0.55, y: 0.75, r: 0.22, ry: 0.3, jitter: 0.5 },
      { x: 0.15, y: 0.55, r: 0.16, ry: 0.28, jitter: 0.6 },
      { x: 0.9, y: 0.7, r: 0.16, ry: 0.28, jitter: 0.5 },
    ],
    head: 'blaze',
    whiteSocks: true,
    whiteSwitch: true,
    muzzle: '#e6c2a8',
    nose: '#d9a48c',
    horns: 'none',
    hornColor: '#e0d0b0',
    hoof: '#5a4030',
    build: 'dairy',
    size: 0.96,
    udder: 0.95,
    eye: '#2a1d14',
  },
  {
    id: 'longhorn',
    name: 'Texas Longhorn',
    origin: 'Texas, USA',
    fact: 'Texas Longhorns have enormous horns that can stretch wider than a car! They come in every colour and speckle you can imagine.',
    coat: '#e9dfcf',
    marking: '#8b3a22',
    pattern: 'speckle',
    speckles: 70,
    patches: [
      { x: 0.8, y: 0.3, r: 0.18, ry: 0.28, jitter: 0.8 },
      { x: 0.25, y: 0.4, r: 0.16, ry: 0.28, jitter: 0.8 },
    ],
    head: 'coat',
    muzzle: '#7a4a3a',
    nose: '#4a2a22',
    horns: 'longhorn',
    hornColor: '#e8dcc4',
    hoof: '#3a2c26',
    build: 'lean',
    size: 1.02,
    udder: 0.2,
    eye: '#2a1d14',
  },
  {
    id: 'galloway',
    name: 'Belted Galloway',
    origin: 'Scotland',
    fact: 'Belted Galloways are black with a wide white belt around their middle, so people call them "Oreo cows"!',
    coat: '#1c1a1a',
    marking: '#f5f1ea',
    pattern: 'belt',
    head: 'coat',
    muzzle: '#151212',
    nose: '#0e0c0c',
    horns: 'none',
    hornColor: '#000',
    hoof: '#151212',
    build: 'beef',
    size: 0.92,
    udder: 0.2,
    shaggy: true,
    eye: '#0a0806',
  },
  {
    id: 'charolais',
    name: 'Charolais',
    origin: 'France',
    fact: 'Charolais cattle are creamy white and very big and strong. They are one of the biggest cows in the world!',
    coat: '#efe6d3',
    pattern: 'solid',
    head: 'coat',
    muzzle: '#e6c6b4',
    nose: '#d4a090',
    horns: 'short',
    hornColor: '#e8dcc4',
    hoof: '#b9a48a',
    build: 'beef',
    size: 1.12,
    udder: 0.25,
    eye: '#3a2a1c',
  },
  {
    id: 'simmental',
    name: 'Simmental',
    origin: 'Switzerland',
    fact: 'Simmentals are golden-red and white with a white face. They are gentle giants that come from the Swiss Alps.',
    coat: '#b7683a',
    marking: '#f7f2e8',
    pattern: 'patches',
    patches: [
      { x: 0.45, y: 0.72, r: 0.24, ry: 0.32, jitter: 0.5 },
      { x: 0.1, y: 0.5, r: 0.14, ry: 0.24, jitter: 0.6 },
    ],
    head: 'whiteFace',
    whiteSocks: true,
    whiteBelly: true,
    whiteSwitch: true,
    muzzle: '#e9c3ae',
    nose: '#d9a08e',
    horns: 'none',
    hornColor: '#e8dcc4',
    hoof: '#5a4030',
    build: 'beef',
    size: 1.08,
    udder: 0.4,
    eye: '#2a1d14',
  },
  {
    id: 'ayrshire',
    name: 'Ayrshire',
    origin: 'Scotland',
    fact: 'Ayrshires are red-and-white cows with elegant horns that curve up like a lyre. They are great climbers on hilly farms.',
    coat: '#f7f3ea',
    marking: '#8d2f1e',
    pattern: 'patches',
    patches: [
      { x: 0.82, y: 0.4, r: 0.2, ry: 0.4, jitter: 0.6 },
      { x: 0.5, y: 0.25, r: 0.15, ry: 0.22, jitter: 0.7 },
      { x: 0.2, y: 0.35, r: 0.2, ry: 0.36, jitter: 0.6 },
    ],
    head: 'dark',
    whiteSocks: true,
    whiteBelly: true,
    whiteSwitch: true,
    muzzle: '#3a2a26',
    nose: '#2a1c1a',
    horns: 'lyre',
    hornColor: '#e6d8bd',
    hoof: '#3a2c26',
    build: 'dairy',
    size: 0.98,
    udder: 0.9,
    eye: '#2a1d14',
  },
];

export const COW_NAMES = [
  'Daisy', 'Bella', 'Buttercup', 'Clover', 'Rosie', 'Maggie', 'Hazel', 'Molly', 'Poppy', 'Willow',
  'Bessie', 'Honey', 'Dottie', 'Pearl', 'Luna', 'Ginger', 'Cocoa', 'Maple', 'Olive', 'Ruby',
];

export function cowBreedById(id: string): CowBreed {
  const b = COW_BREEDS.find((x) => x.id === id);
  if (!b) throw new Error(`Unknown cow breed: ${id}`);
  return b;
}

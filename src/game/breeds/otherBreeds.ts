/**
 * Real breeds for the other farm animals. Kept compact: colour and a few
 * distinguishing features per breed, plus a fun fact for the player.
 */

export interface HorseBreed {
  id: string;
  name: string;
  fact: string;
  coat: string;
  mane: string;
  /** Face marking. */
  blaze?: 'blaze' | 'star' | 'none';
  /** White lower legs. */
  socks?: boolean;
  /** Long silky hair around the hooves (Clydesdale, Shire, Friesian). */
  feathers?: boolean;
  /** Leopard-style spots (Appaloosa). */
  spots?: string;
  /** Large white patches (Paint / Pinto). */
  patches?: string;
  /** Overall scale. Shetland ponies are tiny, Clydesdales huge. */
  size: number;
  heavy?: boolean;
  hoof: string;
  muzzle: string;
}

export const HORSE_BREEDS: HorseBreed[] = [
  {
    id: 'clydesdale',
    name: 'Clydesdale',
    fact: 'Clydesdales are giant, gentle work horses with fluffy white feathers on their feet. One can pull a whole wagon by itself!',
    coat: '#5a2e1a',
    mane: '#1d1512',
    blaze: 'blaze',
    socks: true,
    feathers: true,
    size: 1.2,
    heavy: true,
    hoof: '#2b2420',
    muzzle: '#2a1d16',
  },
  {
    id: 'palomino',
    name: 'Palomino',
    fact: 'Palominos shine like gold with a white mane and tail. Cowboys in old movies loved to ride them.',
    coat: '#d9a94f',
    mane: '#f7f0dc',
    blaze: 'star',
    socks: true,
    size: 1,
    hoof: '#6a5a4a',
    muzzle: '#b98a48',
  },
  {
    id: 'appaloosa',
    name: 'Appaloosa',
    fact: 'Appaloosas are covered in spots like a leopard! Each one has its own pattern and even striped hooves.',
    coat: '#f2ede2',
    mane: '#5a4a40',
    spots: '#4a3a30',
    size: 1,
    hoof: '#8a7a6a',
    muzzle: '#8f7a6d',
  },
  {
    id: 'paint',
    name: 'American Paint',
    fact: 'Paint horses have big splashes of white and brown, like someone painted them. No two Paints match!',
    coat: '#8a4b2a',
    mane: '#f5efe3',
    patches: '#f5efe3',
    socks: true,
    size: 1,
    hoof: '#3a2c26',
    muzzle: '#d9b5a3',
  },
  {
    id: 'friesian',
    name: 'Friesian',
    fact: 'Friesians are shiny black horses from the Netherlands with a long wavy mane. They love to prance and trot high.',
    coat: '#161414',
    mane: '#0c0a0a',
    feathers: true,
    size: 1.08,
    hoof: '#151212',
    muzzle: '#0e0c0c',
  },
  {
    id: 'shetland',
    name: 'Shetland Pony',
    fact: 'Shetland ponies are tiny but super strong, with a thick fuzzy coat to keep warm on windy islands.',
    coat: '#a0522d',
    mane: '#6b3a1e',
    blaze: 'star',
    size: 0.62,
    heavy: true,
    hoof: '#3a2c26',
    muzzle: '#7a4a30',
  },
];

export interface DogBreed {
  id: string;
  name: string;
  fact: string;
  coat: string;
  marking?: string;
  pattern: 'solid' | 'collie' | 'merle' | 'tricolor' | 'saddle';
  ears: 'up' | 'floppy' | 'semi';
  tail: 'plume' | 'curl' | 'straight';
  fluffy?: boolean;
  size: number;
  nose: string;
}

export const DOG_BREEDS: DogBreed[] = [
  {
    id: 'bordercollie',
    name: 'Border Collie',
    fact: 'Border Collies are the smartest dogs on the farm. They herd sheep by staring at them and running in circles!',
    coat: '#1c1a1a',
    marking: '#f6f2ea',
    pattern: 'collie',
    ears: 'semi',
    tail: 'plume',
    fluffy: true,
    size: 1,
    nose: '#111',
  },
  {
    id: 'golden',
    name: 'Golden Retriever',
    fact: 'Golden Retrievers are friendly and love to fetch and swim. Their wavy golden fur is super soft.',
    coat: '#d9a35a',
    pattern: 'solid',
    ears: 'floppy',
    tail: 'plume',
    fluffy: true,
    size: 1.08,
    nose: '#222',
  },
  {
    id: 'aussie',
    name: 'Australian Shepherd',
    fact: 'Australian Shepherds have swirly "merle" coats and sometimes one blue eye and one brown eye!',
    coat: '#8d8f93',
    marking: '#2b2b2b',
    pattern: 'merle',
    ears: 'semi',
    tail: 'straight',
    fluffy: true,
    size: 1,
    nose: '#222',
  },
  {
    id: 'beagle',
    name: 'Beagle',
    fact: 'Beagles have a super nose and long floppy ears. They follow smells everywhere and howl when they find one!',
    coat: '#f4eee2',
    marking: '#b5652e',
    pattern: 'tricolor',
    ears: 'floppy',
    tail: 'straight',
    size: 0.78,
    nose: '#111',
  },
  {
    id: 'bernese',
    name: 'Bernese Mountain Dog',
    fact: 'Bernese Mountain Dogs are big fluffy giants from the Swiss mountains. They used to pull little milk carts.',
    coat: '#1b1818',
    marking: '#a5502a',
    pattern: 'tricolor',
    ears: 'floppy',
    tail: 'plume',
    fluffy: true,
    size: 1.25,
    nose: '#111',
  },
  {
    id: 'corgi',
    name: 'Corgi',
    fact: 'Corgis are short with big ears and a fluffy bottom. They were bred to herd cattle by nipping at their heels!',
    coat: '#d98b4a',
    marking: '#f7f2ea',
    pattern: 'saddle',
    ears: 'up',
    tail: 'straight',
    size: 0.7,
    nose: '#111',
  },
];

export interface PigBreed {
  id: string;
  name: string;
  fact: string;
  skin: string;
  marking?: string;
  pattern: 'solid' | 'spots' | 'points' | 'saddle';
  ears: 'up' | 'floppy';
  size: number;
}

export const PIG_BREEDS: PigBreed[] = [
  {
    id: 'yorkshire',
    name: 'Yorkshire',
    fact: 'Yorkshire pigs are pink with big ears that stand up. Pigs roll in mud to stay cool because they cannot sweat!',
    skin: '#f2b5a8',
    pattern: 'solid',
    ears: 'up',
    size: 1,
  },
  {
    id: 'berkshire',
    name: 'Berkshire',
    fact: 'Berkshire pigs are black with six white points: four white feet, a white nose and a white tail tip.',
    skin: '#221e1e',
    marking: '#f5efe6',
    pattern: 'points',
    ears: 'up',
    size: 1,
  },
  {
    id: 'oldspot',
    name: 'Gloucester Old Spot',
    fact: 'Gloucester Old Spots are pink pigs with big black spots. Legend says the spots are bruises from falling apples!',
    skin: '#f0b9ad',
    marking: '#2a2424',
    pattern: 'spots',
    ears: 'floppy',
    size: 1.05,
  },
  {
    id: 'saddleback',
    name: 'Saddleback',
    fact: 'Saddleback pigs are black with a white band over their shoulders, like a saddle. They love to root in the dirt.',
    skin: '#242020',
    marking: '#f3ede4',
    pattern: 'saddle',
    ears: 'floppy',
    size: 1,
  },
];

export interface SheepBreed {
  id: string;
  name: string;
  fact: string;
  wool: string;
  face: string;
  legs: string;
  horns?: boolean;
  size: number;
}

export const SHEEP_BREEDS: SheepBreed[] = [
  {
    id: 'suffolk',
    name: 'Suffolk',
    fact: 'Suffolk sheep have a fluffy white coat with a black face and black legs. Their wool is made into cosy sweaters.',
    wool: '#f1ede3',
    face: '#1e1a1a',
    legs: '#1e1a1a',
    size: 1,
  },
  {
    id: 'merino',
    name: 'Merino',
    fact: 'Merino sheep grow the softest, finest wool in the world. A shearer can trim a whole Merino in under a minute!',
    wool: '#e9e2d0',
    face: '#e4d6c0',
    legs: '#d8c9b0',
    size: 0.95,
  },
  {
    id: 'jacob',
    name: 'Jacob',
    fact: 'Jacob sheep are spotted black and white and can grow four horns at once!',
    wool: '#f2eee6',
    face: '#f2eee6',
    legs: '#2a2424',
    horns: true,
    size: 0.9,
  },
];

export interface GoatBreed {
  id: string;
  name: string;
  fact: string;
  coat: string;
  marking?: string;
  ears: 'long' | 'up';
  beard: boolean;
  size: number;
}

export const GOAT_BREEDS: GoatBreed[] = [
  {
    id: 'nubian',
    name: 'Nubian',
    fact: 'Nubian goats have long floppy ears and a curved Roman nose. They are very chatty and love to climb on everything.',
    coat: '#7a4a2e',
    ears: 'long',
    beard: false,
    size: 1,
  },
  {
    id: 'alpine',
    name: 'Alpine',
    fact: 'Alpine goats come from the mountains and can climb almost anything, even steep rocks!',
    coat: '#5a4a40',
    marking: '#e9e0cf',
    ears: 'up',
    beard: true,
    size: 1,
  },
  {
    id: 'pygmy',
    name: 'Pygmy Goat',
    fact: 'Pygmy goats are tiny, round and bouncy. They hop sideways when they are happy!',
    coat: '#9c9088',
    marking: '#2d2624',
    ears: 'up',
    beard: true,
    size: 0.65,
  },
];

export interface ChickenBreed {
  id: string;
  name: string;
  fact: string;
  body: string;
  tail: string;
  barred?: boolean;
  silkie?: boolean;
  rooster?: boolean;
  size: number;
}

export const CHICKEN_BREEDS: ChickenBreed[] = [
  {
    id: 'rir',
    name: 'Rhode Island Red',
    fact: 'Rhode Island Reds are rusty red hens that lay big brown eggs almost every day.',
    body: '#9c3f1e',
    tail: '#2a1a14',
    size: 1,
  },
  {
    id: 'leghorn',
    name: 'White Leghorn',
    fact: 'White Leghorns are snowy white with a big floppy red comb. They lay the white eggs you see in the shop.',
    body: '#f7f5ee',
    tail: '#f0ede4',
    rooster: true,
    size: 1,
  },
  {
    id: 'plymouth',
    name: 'Barred Plymouth Rock',
    fact: 'Barred Plymouth Rocks have black and white stripes on every feather, like a tiny zebra chicken!',
    body: '#5a5a5a',
    tail: '#3a3a3a',
    barred: true,
    size: 1.05,
  },
  {
    id: 'silkie',
    name: 'Silkie',
    fact: 'Silkies are fluffy like a cotton ball and have five toes instead of four. Their feathers feel like silk.',
    body: '#f5f2ea',
    tail: '#f5f2ea',
    silkie: true,
    size: 0.85,
  },
];

export interface DuckBreed {
  id: string;
  name: string;
  fact: string;
  body: string;
  head: string;
  bill: string;
  feet: string;
  size: number;
  ring?: boolean;
}

export const DUCK_BREEDS: DuckBreed[] = [
  {
    id: 'pekin',
    name: 'Pekin',
    fact: 'Pekin ducks are big, white and waddly with orange bills. The most famous cartoon ducks are Pekins!',
    body: '#f7f5ee',
    head: '#f7f5ee',
    bill: '#f2a93b',
    feet: '#e98a2f',
    size: 1,
  },
  {
    id: 'mallard',
    name: 'Mallard',
    fact: 'Mallard drakes have shiny green heads and a white ring around their neck. They quack and dabble for pond weeds.',
    body: '#8a7a68',
    head: '#1f6e3a',
    bill: '#d9c53a',
    feet: '#e98a2f',
    size: 0.85,
    ring: true,
  },
  {
    id: 'indianrunner',
    name: 'Indian Runner',
    fact: 'Indian Runner ducks stand up tall like bowling pins and run instead of waddle!',
    body: '#6a5a4a',
    head: '#4a3a30',
    bill: '#2f2a24',
    feet: '#3a3028',
    size: 0.9,
  },
];

export interface FarmerSpec {
  id: string;
  name: string;
  fact: string;
  skin: string;
  hair: string;
  hat: 'straw' | 'cap' | 'none';
  shirt: string;
  overalls: string;
  boots: string;
  size: number;
  kid?: boolean;
}

export const FARMERS: FarmerSpec[] = [
  {
    id: 'joe',
    name: 'Farmer Joe',
    fact: 'Farmer Joe wakes up before the sun to feed all the animals. He drives the red tractor and loves his straw hat.',
    skin: '#e8b48d',
    hair: '#5a3a22',
    hat: 'straw',
    shirt: '#c62828',
    overalls: '#3b5ba5',
    boots: '#4a3320',
    size: 1,
  },
  {
    id: 'maya',
    name: 'Farmer Maya',
    fact: 'Farmer Maya takes care of the cows and knows every one by name. Her boots are always muddy!',
    skin: '#8d5a3a',
    hair: '#1c1512',
    hat: 'cap',
    shirt: '#f9a825',
    overalls: '#2e7d5b',
    boots: '#c62828',
    size: 0.96,
  },
  {
    id: 'sam',
    name: 'Sam',
    fact: 'Sam is the farm kid who collects eggs every morning and gives the ponies apples.',
    skin: '#f1c9a5',
    hair: '#d98c3a',
    hat: 'none',
    shirt: '#42a5f5',
    overalls: '#6d4c41',
    boots: '#2e7d32',
    size: 0.7,
    kid: true,
  },
];

export interface TractorSpec {
  id: string;
  name: string;
  fact: string;
  body: string;
  wheels: string;
  rims: string;
  size: number;
  trailer?: boolean;
}

export const TRACTORS: TractorSpec[] = [
  {
    id: 'red',
    name: 'Big Red Tractor',
    fact: 'The big red tractor has giant back wheels so it never gets stuck in the mud. Toot toot!',
    body: '#d32f2f',
    wheels: '#222',
    rims: '#e0e0e0',
    size: 1,
  },
  {
    id: 'green',
    name: 'Green Tractor',
    fact: 'The green tractor pulls the plough and the hay trailer. Its engine goes chug-chug-chug.',
    body: '#2e7d32',
    wheels: '#222',
    rims: '#fdd835',
    size: 1.05,
    trailer: true,
  },
  {
    id: 'blue',
    name: 'Little Blue Tractor',
    fact: 'The little blue tractor is small but zippy. It is perfect for driving between the apple trees.',
    body: '#1565c0',
    wheels: '#222',
    rims: '#f5f5f5',
    size: 0.8,
  },
];

# Farm Friends (cow-farming)

A farm game for kids on iPhone: cows, dogs, horses, pigs, sheep, goats, chickens, ducks, farmers and tractors on one big scrolling farm.

The twist: **you can become any character or animal.** Tap a cow and you are that cow. Tap the tractor and you drive the tractor.

The cows are drawn as **real breeds**, with the markings, horns, build and colours of the actual animals:

| Breed | What makes it recognisable |
| --- | --- |
| Holstein Friesian | Black and white patches, each cow's pattern unique |
| Jersey | Small, fawn coat with dark shading, big dark eyes, pale "mealy" muzzle |
| Aberdeen Angus | Solid black, polled (no horns), stocky |
| Hereford | Rusty red body, white face, white crest, chest, belly and socks |
| Highland | Long shaggy ginger coat, fringe over the eyes, long upswept horns |
| Brown Swiss | Mouse-grey coat, big fuzzy ears, pale muzzle ring |
| Guernsey | Golden fawn and white patches, blaze on the face |
| Texas Longhorn | Enormous horns, speckled coat, lean build |
| Belted Galloway | Black with a wide white belt, shaggy coat |
| Charolais | Creamy white, heavily muscled |
| Simmental | Gold-red and white, white face, big frame |
| Ayrshire | Red and white patches, lyre-shaped horns |

Horses (Clydesdale, Palomino, Appaloosa, Paint, Friesian, Shetland), dogs (Border Collie, Golden Retriever, Australian Shepherd, Beagle, Bernese, Corgi), pigs, sheep, goats, chickens and ducks are real breeds too. Every character has a short fun fact that is shown and read aloud when you become it.

All artwork is drawn procedurally on an HTML canvas, so the app has no image assets and every cow of a breed gets its own individual markings.

## How to play

- **Tap any animal, farmer or tractor** to become it.
- **Drag anywhere** to walk (a floating joystick appears), or **tap the ground** to walk there.
- **Big orange button** makes your character's sound and action: cows moo and graze, dogs bark and herd the sheep, chickens lay eggs, pigs splash in the mud, horses rear up, ducks splash, tractors toot and puff smoke, farmers wave and give hearts.
- **Book button** opens the album of every character so you can pick who to be.
- **Speaker button** mutes sounds and the spoken facts.
- A day lasts four minutes. At night the animals go to sleep.

Farmers can pick up the eggs the chickens lay.

## The Cow Show mini-game

At the far right of the farm is the fair: a show barn with a red banner over every cow's stall (name, breed, owner and the rosettes she has won) and a show ring with wood shavings, white rails, bleachers and the judge's table under the "Farm Fair" banner.

Become any cow and walk into the ring (the purple rosette button jumps you straight to the ring gate), then tap **Start the Cow Show!**. Three other cows join your class and the show runs like a real one:

1. **Groom.** Swipe over your cow's coat to brush her until the shine meter is full.
2. **Lead.** Lead her around the ring on the halter, keeping close to the judge's star.
3. **Set up.** Tap when the swinging needle is in the green to stand her square for the judge.
4. **Judging.** The judge walks the line, then hands out the ribbons: purple for Grand Champion, then blue, red, yellow and white.

Ribbons are saved on the device. A prize cow wears her latest rosette, and every ribbon hangs on her stall banner in the show barn and shows in the album.

## Running it in a browser

```bash
npm install
npm run dev
```

Open http://localhost:5173. Add `?gallery=cows` (or `horses`, `dogs`, `small`, `birds`, `people`, `all`) to see every breed drawn large.

```bash
npm test          # unit tests (vitest)
npm run typecheck # strict TypeScript
npm run build     # production build into dist/
npm run screenshots  # headless Chromium screenshots of the galleries and the game (needs `npm run dev` running)
```

## Building the iPhone app

The game is a Capacitor app. You need a Mac with Xcode and CocoaPods installed.

```bash
npm install
npm run build
npm run ios:add     # first time only: creates the ios/ Xcode project
npm run ios:sync    # copies dist/ into the iOS project (run after every web build)
npm run ios:open    # opens the project in Xcode
```

In Xcode, select your team under Signing & Capabilities and run on a simulator or a connected iPhone.

Recommended settings for a kids game, set in `ios/App/App/Info.plist` after `ios:add`:

- Lock to landscape: set `UISupportedInterfaceOrientations` (and the `~ipad` variant) to `UIInterfaceOrientationLandscapeLeft` and `UIInterfaceOrientationLandscapeRight` only.
- Hide the status bar: `UIStatusBarHidden` = `YES` and `UIViewControllerBasedStatusBarAppearance` = `NO`.

The web build also runs in portrait, but landscape gives the farm the most room.

## Project layout

```
src/main.ts                 bootstrap (game, or ?gallery= design view)
src/game/game.ts            game loop, camera, HUD, album, "become" mechanic, actions
src/game/entity.ts          character state, wander AI, grazing, sleeping, swimming
src/game/world.ts           farm layout, sky/day-night, ground, buildings and props
src/game/characters.ts      the roster of playable characters
src/game/breeds/            breed data (colours, markings, horns, facts)
src/game/art/               procedural renderers: cowArt, horseArt, dogArt, smallAnimalArt, birdArt, peopleArt, tractorArt
src/game/audio/sfx.ts       Web Audio synthesised animal sounds and speech
src/game/effects.ts         speech bubbles and particles
src/game/input.ts           touch joystick and taps
scripts/screenshots.mjs     Playwright screenshots for checking the artwork
tests/                      vitest unit tests
```

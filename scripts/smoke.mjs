// End-to-end smoke test: taps through the HUD like a player would and checks the
// game reacts. Usage: node scripts/smoke.mjs [baseUrl]   (needs `npm run dev` running)
import { chromium, devices } from 'playwright';
import { existsSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
const iphone = devices['iPhone 13 landscape'];
const context = await browser.newContext({ ...iphone, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}/`);
await page.waitForTimeout(800);

const state = () => page.evaluate(() => window.farm.debugState());
const layout = () => page.evaluate(() => window.farm.debugLayout());
const tap = async ({ x, y }) => {
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(250);
};
const check = (cond, msg) => {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else console.log('ok:', msg);
};

const start = await state();
check(start.player === 'farmer-joe', 'starts as Farmer Joe');

// First tap unlocks audio.
await tap((await layout()).action);
const afterAction = await state();
check(afterAction.audio === 'running', `audio context running after a tap (was ${afterAction.audio})`);

// Album: open, pick a character, closes and switches.
await tap((await layout()).album);
check((await state()).albumOpen, 'album opens from the book button');
const card = await page.evaluate(() => window.farm.debugAlbumCard(3));
await tap(card);
const picked = await state();
check(!picked.albumOpen, 'album closes after picking a character');
check(picked.player === 'cow-holstein', `picked character becomes the player (got ${picked.player})`);

// Album: open then close with the X.
await tap((await layout()).album);
check((await state()).albumOpen, 'album opens again');
await tap((await layout()).album);
check(!(await state()).albumOpen, 'album closes from the X button');

// Sound toggle.
await tap((await layout()).sound);
check((await state()).muted === true, 'sound button mutes');
await tap((await layout()).sound);
check((await state()).muted === false, 'sound button unmutes');

// Tapping an animal in the world becomes it: bring Farmer Joe next to the player first.
await page.evaluate(() => window.farm.debugBecome('farmer-joe'));
await page.waitForTimeout(300);
const cowPos = await page.evaluate(() => window.farm.debugEntityScreen('cow-holstein'));
await page.evaluate(() => {
  const s = window.farm.debugState();
  return s;
});
// Move the camera/player near Daisy by becoming her, then Joe, so both are on screen.
await page.evaluate(() => window.farm.debugBecome('cow-holstein'));
await page.evaluate(() => window.farm.debugBecome('farmer-joe'));
await page.waitForTimeout(300);
const joeState = await state();
check(joeState.player === 'farmer-joe', 'debug become returns to Farmer Joe');
const daisy = await page.evaluate(() => window.farm.debugEntityScreen('cow-holstein'));
if (daisy && daisy.x > 0 && daisy.x < 844 && daisy.y > 0 && daisy.y < 390) {
  await tap(daisy);
  check((await state()).player === 'cow-holstein', 'tapping a cow in the world becomes that cow');
} else {
  console.log('skip: Daisy off screen at', JSON.stringify(daisy ?? cowPos));
}

// Action button as a cow moos without errors.
await tap((await layout()).action);
await page.waitForTimeout(300);
check(errors.length === 0, `no page errors (${errors.join(' | ')})`);

await browser.close();
console.log(process.exitCode ? 'SMOKE FAILED' : 'SMOKE PASSED');

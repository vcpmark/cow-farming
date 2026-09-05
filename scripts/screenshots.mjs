// Renders the game / galleries with headless Chromium for visual checks.
// Usage: node scripts/screenshots.mjs [baseUrl]
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
mkdirSync('screenshots', { recursive: true });
// Use a preinstalled Chromium when one is available (CI / sandbox), else Playwright's own.
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
const shots = [
  { name: 'cows-gallery', url: `${base}/?gallery=cows`, size: { width: 1200, height: 640 }, full: true },
  { name: 'horses-gallery', url: `${base}/?gallery=horses`, size: { width: 1200, height: 640 }, full: true },
  { name: 'dogs-gallery', url: `${base}/?gallery=dogs`, size: { width: 1200, height: 640 }, full: true },
  { name: 'small-gallery', url: `${base}/?gallery=small`, size: { width: 1200, height: 640 }, full: true },
  { name: 'birds-gallery', url: `${base}/?gallery=birds`, size: { width: 1200, height: 640 }, full: true },
  { name: 'people-gallery', url: `${base}/?gallery=people`, size: { width: 1200, height: 640 }, full: true },
  { name: 'game-landscape', url: `${base}/`, size: { width: 844, height: 390 } },
  { name: 'game-cow', url: `${base}/`, size: { width: 844, height: 390 }, run: 'farm.debugBecome("cow-holstein")', wait: 1500 },
  { name: 'game-horse-night', url: `${base}/`, size: { width: 844, height: 390 }, run: 'farm.debugBecome("horse-clydesdale"); farm.debugDismissCard(); farm.debugSetTime(190)', wait: 1500 },
  { name: 'game-album', url: `${base}/`, size: { width: 844, height: 390 }, run: 'farm.debugOpenAlbum(true)', wait: 800 },
  { name: 'game-fair', url: `${base}/`, size: { width: 844, height: 390 }, run: 'farm.debugBecome("cow-jersey"); farm.debugGoToShow(); farm.debugSetTime(40)', wait: 1200 },
  { name: 'game-show-groom', url: `${base}/`, size: { width: 844, height: 390 }, run: 'farm.debugStartShow(); farm.debugShowPhase("groom")', wait: 1500 },
  { name: 'game-show-walk', url: `${base}/`, size: { width: 844, height: 390 }, run: 'farm.debugStartShow(); farm.debugShowPhase("walk")', wait: 4000 },
  { name: 'game-show-pose', url: `${base}/`, size: { width: 844, height: 390 }, run: 'farm.debugStartShow(); farm.debugShowPhase("pose")', wait: 2500 },
  { name: 'game-show-results', url: `${base}/`, size: { width: 844, height: 390 }, run: 'farm.debugStartShow(); farm.debugShowPhase("judging")', wait: 6500 },
  { name: 'game-install-hint', url: `${base}/`, size: { width: 844, height: 390 }, run: 'farm.debugShowInstallHint()', wait: 800 },
  { name: 'game-portrait', url: `${base}/`, size: { width: 390, height: 844 }, run: 'farm.debugBecome("pig-oldspot")', wait: 1500 },
];
for (const s of shots) {
  const page = await browser.newPage({ viewport: s.size, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(s.url);
  await page.waitForTimeout(800);
  if (s.run) {
    await page.evaluate(s.run);
    await page.waitForTimeout(s.wait ?? 1000);
  }
  await page.screenshot({ path: `screenshots/${s.name}.png`, fullPage: !!s.full });
  console.log(`saved screenshots/${s.name}.png`, errors.length ? `ERRORS: ${errors.join(' | ')}` : '');
  await page.close();
}
await browser.close();

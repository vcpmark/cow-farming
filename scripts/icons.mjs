// Renders the PWA icons and iPhone launch screens from the game's own artwork.
// Usage: node scripts/icons.mjs [baseUrl]   (needs `npm run dev` running)
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
mkdirSync('public/icons', { recursive: true });
mkdirSync('public/splash', { recursive: true });
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });

async function shoot(url, path, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.waitForTimeout(400);
  await page.locator('#game').screenshot({ path, omitBackground: true });
  await page.close();
  console.log('saved', path);
}

await shoot(`${base}/?icon=512`, 'public/icons/icon-512.png', 512, 512);
await shoot(`${base}/?icon=192`, 'public/icons/icon-192.png', 192, 192);
await shoot(`${base}/?icon=512&maskable=1`, 'public/icons/icon-512-maskable.png', 512, 512);
await shoot(`${base}/?icon=180&maskable=1`, 'public/icons/apple-touch-icon.png', 180, 180);
for (const [w, h] of [
  [1290, 2796],
  [1179, 2556],
  [1170, 2532],
  [750, 1334],
]) {
  await shoot(`${base}/?splash=${w}x${h}`, `public/splash/splash-${w}x${h}.png`, w, h);
  await shoot(`${base}/?splash=${h}x${w}`, `public/splash/splash-${h}x${w}.png`, h, w);
}
await browser.close();

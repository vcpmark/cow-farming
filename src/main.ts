import { Game } from './game/game';
import { renderGallery } from './gallery';
import { renderIcon, renderSplash } from './splash';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const gallery = params.get('gallery');
const icon = params.get('icon');
const splash = params.get('splash');

if (gallery) {
  // Design/debug view: ?gallery=cows|horses|dogs|small|birds|people|all
  document.body.style.overflow = 'auto';
  renderGallery(canvas, gallery);
} else if (icon) {
  // App icon rendering for scripts/icons.mjs: ?icon=512 or ?icon=512&maskable=1
  renderIcon(canvas, parseInt(icon, 10), params.get('maskable') === '1');
} else if (splash) {
  // Launch screen rendering: ?splash=1179x2556
  const [w, h] = splash.split('x').map((v) => parseInt(v, 10));
  renderSplash(canvas, w, h);
} else {
  const game = new Game(canvas);
  game.start();
  // Debug hook used by scripts/screenshots.mjs and handy in the browser console.
  (window as unknown as { farm: Game }).farm = game;
}

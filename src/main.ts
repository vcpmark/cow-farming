import { Game } from './game/game';
import { renderGallery } from './gallery';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const params = new URLSearchParams(location.search);
const gallery = params.get('gallery');

if (gallery) {
  // Design/debug view: ?gallery=cows|horses|dogs|small|birds|people|all
  document.body.style.overflow = 'auto';
  renderGallery(canvas, gallery);
} else {
  const game = new Game(canvas);
  game.start();
  // Debug hook used by scripts/screenshots.mjs and handy in the browser console.
  (window as unknown as { farm: Game }).farm = game;
}

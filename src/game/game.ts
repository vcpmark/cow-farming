/**
 * Farm Friends: the game. A side-on farm you scroll through, full of real
 * breeds of animals. Tap any animal, farmer or tractor to become it, then
 * drag to walk and press the big button to make its sound.
 */
import { buildCharacters, type CharacterDef } from './characters';
import { Entity } from './entity';
import { Effects } from './effects';
import { Input } from './input';
import { portraitOf } from './portraits';
import { Sfx, speak } from './audio/sfx';
import { drawFarmer } from './art/peopleArt';
import { CowShow, JUDGE, RIBBON_COLORS, drawStallBanners, drawStartPrompt, type Ribbon } from './show';
import { clamp, lerp, mixColor, roundRectPath } from './util';
import {
  AREAS,
  GROUND_BOTTOM,
  GROUND_TOP,
  HORIZON,
  RING,
  VIEW_H,
  WORLD_WIDTH,
  drawRosette,
  inRing,
  buildProps,
  daylight,
  drawGround,
  drawSign,
  drawSky,
  inMud,
  inPond,
  type Prop,
} from './world';

interface Egg {
  x: number;
  y: number;
  life: number;
}

interface Card {
  def: CharacterDef;
  life: number;
}

const ACTION_R = 36;
const BTN_R = 24;

export class Game {
  private ctx: CanvasRenderingContext2D;
  private cssW = 1;
  private cssH = 1;
  private dpr = 1;
  private scale = 1;
  private viewW = 560;
  private viewH = VIEW_H;
  private offY = 0;

  private entities: Entity[] = [];
  private props: Prop[] = [];
  private effects = new Effects();
  private sfx = new Sfx();
  private input: Input;
  private player!: Entity;
  private camX = 0;
  private time = 30; // start mid-morning
  private last = performance.now();
  private eggs: Egg[] = [];
  private eggCount = 0;
  private card: Card | null = null;
  private albumOpen = false;
  private albumScroll = 0;
  private albumDragId: number | null = null;
  private albumDragY = 0;
  private albumMoved = false;
  private hintLife = 12;
  private becomes = 0;
  private running = false;
  private show: CowShow;
  private ribbons = new Map<string, Ribbon[]>();
  private startPrompt: { x: number; y: number; w: number; h: number } | null = null;
  private showHint = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.input = new Input(canvas, (px, py) => this.toLogical(px, py));
    this.input.onFirstInteraction = () => this.sfx.unlock();
    this.show = new CowShow({
      effects: this.effects,
      sfx: this.sfx,
      speak: (t) => speak(t, this.sfx.muted),
      award: (id, rb) => this.awardRibbon(id, rb),
    });
    this.loadRibbons();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.populate();
  }

  private resize(): void {
    this.dpr = Math.min(2.5, window.devicePixelRatio || 1);
    this.cssW = window.innerWidth;
    this.cssH = window.innerHeight;
    this.canvas.width = Math.round(this.cssW * this.dpr);
    this.canvas.height = Math.round(this.cssH * this.dpr);
    this.canvas.style.width = `${this.cssW}px`;
    this.canvas.style.height = `${this.cssH}px`;
    const landscape = this.cssW / this.cssH >= 1.25;
    this.scale = landscape ? this.cssH / VIEW_H : this.cssW / 460;
    this.viewW = this.cssW / this.scale;
    this.viewH = this.cssH / this.scale;
    // Portrait phones get extra room: centre the scene and fill below with grass.
    this.offY = Math.max(0, (this.viewH - VIEW_H) * 0.55);
  }

  private toLogical(px: number, py: number): [number, number] {
    return [px / this.scale, py / this.scale];
  }

  private populate(): void {
    const defs = buildCharacters();
    for (const def of defs) {
      const [h0, h1] = def.home;
      const x = lerp(h0 + 40, h1 - 40, Math.random());
      const y = lerp(GROUND_TOP + 10, GROUND_BOTTOM - 4, Math.random());
      this.entities.push(new Entity(def, x, y));
    }
    this.props = buildProps();
    const joe = this.entities.find((e) => e.def.id === 'farmer-joe')!;
    joe.x = 700;
    joe.y = 350;
    this.setPlayer(joe, false);
    this.camX = clamp(joe.x - this.viewW / 2, 0, WORLD_WIDTH - this.viewW);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---- ribbons ---------------------------------------------------------------

  private loadRibbons(): void {
    try {
      const raw = localStorage.getItem('farm-ribbons');
      if (raw) {
        const obj = JSON.parse(raw) as Record<string, Ribbon[]>;
        for (const [k, v] of Object.entries(obj)) if (Array.isArray(v)) this.ribbons.set(k, v);
      }
    } catch {
      /* ignore */
    }
  }

  private awardRibbon(id: string, rb: Ribbon): void {
    const list = this.ribbons.get(id) ?? [];
    list.push(rb);
    this.ribbons.set(id, list);
    try {
      localStorage.setItem('farm-ribbons', JSON.stringify(Object.fromEntries(this.ribbons)));
    } catch {
      /* ignore */
    }
  }

  private ribbonsOf(id: string): Ribbon[] {
    return this.ribbons.get(id) ?? [];
  }

  private get cows(): Entity[] {
    return this.entities.filter((e) => e.def.species === 'cow');
  }

  /** Teleport the player to the show ring gate (the rosette HUD button). */
  private goToShow(): void {
    const p = this.player;
    p.target = null;
    p.x = RING.x0 - 70;
    p.y = (RING.y0 + RING.y1) / 2 + 10;
    p.facing = 1;
    this.camX = clamp(p.x - this.viewW / 2, 0, WORLD_WIDTH - this.viewW);
    this.effects.spawn('sparkle', p.x, p.y - 40, 16);
    this.sfx.sparkle();
    if (p.def.species !== 'cow') {
      this.showHint = 5;
      speak('Only cows can enter the show. Tap a cow to become one!', this.sfx.muted);
    }
  }

  private toScreen(wx: number, wy: number): { x: number; y: number } {
    return { x: wx - this.camX, y: wy + this.offY };
  }

  // ---- debug helpers (used by the screenshot script) -----------------------------

  debugStartShow(): void {
    const cow = this.entities.find((e) => e.def.id === 'cow-holstein')!;
    this.become(cow);
    this.card = null;
    this.goToShow();
    cow.x = (RING.x0 + RING.x1) / 2;
    cow.y = (RING.y0 + RING.y1) / 2 + 14;
    this.camX = clamp(cow.x - this.viewW / 2, 0, WORLD_WIDTH - this.viewW);
    this.show.start(cow, this.cows);
  }

  debugShowPhase(phase: 'groom' | 'walk' | 'pose' | 'judging' | 'results'): void {
    (this.show as unknown as { setPhase: (p: string) => void }).setPhase(phase);
  }

  debugGoToShow(): void {
    this.goToShow();
    this.card = null;
  }

  /** Become the character with this id (e.g. "cow-holstein"). */
  debugBecome(id: string): void {
    const e = this.entities.find((x) => x.def.id === id);
    if (!e) return;
    this.become(e);
    this.camX = clamp(e.x - this.viewW / 2, 0, WORLD_WIDTH - this.viewW);
  }

  debugSetTime(t: number): void {
    this.time = t;
  }

  debugOpenAlbum(open: boolean): void {
    this.albumOpen = open;
    this.albumScroll = 0;
  }

  debugDismissCard(): void {
    this.card = null;
  }

  // ---- becoming a character --------------------------------------------------

  private setPlayer(e: Entity, announce: boolean): void {
    if (this.player) {
      this.player.controlled = false;
      this.player.target = null;
      this.player.aiTimer = 1 + Math.random() * 2;
    }
    this.player = e;
    e.controlled = true;
    e.target = null;
    e.vx = 0;
    e.vy = 0;
    if (announce) {
      this.becomes++;
      this.card = { def: e.def, life: 0 };
      const top = e.y - e.def.hit.h * e.scale * 0.5;
      this.effects.spawn('sparkle', e.x, top, 26);
      this.sfx.sparkle();
      speak(`You are ${e.def.name}, a ${e.def.breed}. ${e.def.fact}`, this.sfx.muted);
    }
  }

  private become(e: Entity): void {
    if (this.show.active) return;
    if (e === this.player) {
      this.doAction();
      return;
    }
    const old = this.player;
    this.effects.spawn('sparkle', old.x, old.y - old.def.hit.h * old.scale * 0.5, 14);
    this.setPlayer(e, true);
    this.hintLife = 0;
  }

  // ---- actions -----------------------------------------------------------------

  private doAction(): void {
    if (this.show.active) {
      this.show.press();
      return;
    }
    const p = this.player;
    const d = p.def;
    const top = p.y - d.hit.h * p.scale;
    p.triggerAction();
    this.effects.say(d.word, p.x, top - 6);
    this.sfx.play(d.sound);
    switch (d.species) {
      case 'cow':
      case 'sheep':
      case 'goat':
        this.effects.spawn('note', p.x, top, 3, { color: d.species === 'cow' ? '#5c6bc0' : '#8e24aa' });
        if (p.canGraze && p.moving < 0.2) {
          p.graze(2.5);
          this.effects.spawn('grass', p.x + p.facing * 40 * p.scale, p.y - 4, 6);
          setTimeout(() => this.sfx.munch(), 500);
        }
        break;
      case 'horse':
        this.effects.spawn('dust', p.x, p.y, 8);
        break;
      case 'dog':
        // Herding: nearby flock animals scatter.
        for (const e of this.entities) {
          if (e === p || e.controlled) continue;
          const s = e.def.species;
          if (s !== 'sheep' && s !== 'chicken' && s !== 'duck' && s !== 'goat') continue;
          const dist = Math.hypot(e.x - p.x, e.y - p.y);
          if (dist < 170) {
            const dir = e.x >= p.x ? 1 : -1;
            e.target = { x: clamp(e.x + dir * 140, e.def.home[0], e.def.home[1]), y: clamp(e.y + (Math.random() - 0.5) * 60, GROUND_TOP + 6, GROUND_BOTTOM) };
            e.ai = 'walk';
            e.aiTimer = 3;
            e.triggerAction();
            this.effects.say('!', e.x, e.y - e.def.hit.h * e.scale - 4, '#fff59d');
          }
        }
        break;
      case 'pig':
        if (inMud(p.x, p.y)) {
          this.effects.spawn('splash', p.x, p.y, 10, { color: '#6d4b2b' });
          this.sfx.splash();
        } else this.effects.spawn('dust', p.x, p.y, 5);
        break;
      case 'chicken':
        if (this.eggs.length < 10 && !inPond(p.x, p.y)) {
          this.eggs.push({ x: p.x - p.facing * 12, y: p.y + 2, life: 0 });
          this.effects.spawn('sparkle', p.x, p.y - 10, 6);
        }
        break;
      case 'duck':
        if (inPond(p.x, p.y)) {
          this.effects.spawn('splash', p.x, p.y + 4, 14);
          this.sfx.splash();
        }
        break;
      case 'farmer':
        for (const e of this.entities) {
          if (e === p) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) < 110) {
            this.effects.spawn('heart', e.x, e.y - e.def.hit.h * e.scale, 3);
            e.triggerAction();
          }
        }
        break;
      case 'tractor':
        this.effects.spawn('smoke', p.x + p.facing * 30 * p.scale, p.y - 60 * p.scale, 6);
        break;
    }
  }

  // ---- update ----------------------------------------------------------------

  private update(dt: number): void {
    this.time += dt;
    const dl = daylight(this.time);
    this.handleInput(dt);

    this.show.update(dt, this.input.pointers.values(), (wx, wy) => this.toScreen(wx, wy));
    if (this.show.active) {
      const p = this.player;
      if (!this.show.playerMayMove && !p.target) {
        p.vx = 0;
        p.vy = 0;
      }
      p.x = clamp(p.x, RING.x0 + 20, RING.x1 - 20);
      p.y = clamp(p.y, RING.y0 + 4, RING.y1);
    }
    this.showHint = Math.max(0, this.showHint - dt);

    const spawnZ = (x: number, y: number) => this.effects.spawn('zzz', x, y, 1);
    for (const e of this.entities) {
      e.update(dt, this.time, dl.isNight, spawnZ);
      // ambient sounds from animals near the camera
      if (!e.controlled && e.soundTimer <= 0 && !dl.isNight) {
        e.soundTimer = 10 + Math.random() * 25;
        const onScreen = e.x > this.camX - 100 && e.x < this.camX + this.viewW + 100;
        if (onScreen && e.def.species !== 'tractor') {
          this.effects.say(e.def.word, e.x, e.y - e.def.hit.h * e.scale - 6);
          const dist = Math.abs(e.x - this.player.x);
          this.sfx.play(e.def.sound, clamp(1 - dist / 700, 0.15, 0.7));
          e.triggerAction();
        }
      }
    }

    // player side-effects while moving
    const p = this.player;
    if (p.moving > 0.3 && Math.random() < dt * 8) {
      if (p.swimming) this.effects.spawn('splash', p.x - p.facing * 10, p.y + 4, 1);
      else if (p.def.species === 'tractor') this.effects.spawn('smoke', p.x + p.facing * 30 * p.scale, p.y - 60 * p.scale, 1);
      else if (p.def.species !== 'chicken' && p.def.species !== 'duck') this.effects.spawn('dust', p.x - p.facing * 10, p.y, 1);
    }
    this.sfx.setEngine(p.def.species === 'tractor', p.moving);

    // eggs
    for (const egg of this.eggs) egg.life += dt;
    if (p.def.species === 'farmer') {
      const before = this.eggs.length;
      this.eggs = this.eggs.filter((egg) => {
        const near = Math.hypot(egg.x - p.x, egg.y - p.y) < 22;
        if (near) {
          this.effects.spawn('sparkle', egg.x, egg.y - 10, 8);
          this.effects.say('+1 egg', p.x, p.y - p.def.hit.h * p.scale - 6, '#fff9c4');
        }
        return !near;
      });
      if (this.eggs.length < before) {
        this.eggCount += before - this.eggs.length;
        this.sfx.ding();
      }
    }
    this.eggs = this.eggs.filter((egg) => egg.life < 90);

    this.effects.update(dt);
    if (this.card) {
      this.card.life += dt;
      if (this.card.life > 8) this.card = null;
    }
    this.hintLife -= dt;

    const targetCam = clamp(p.x - this.viewW / 2, 0, Math.max(0, WORLD_WIDTH - this.viewW));
    this.camX = lerp(this.camX, targetCam, 1 - Math.pow(0.02, dt));
  }

  private handleInput(dt: number): void {
    void dt;
    const vw = this.viewW;
    const vh = this.viewH;
    const actionC = { x: vw - 54, y: vh - 54 };
    const albumC = { x: vw - 34, y: 34 };
    const soundC = { x: vw - 90, y: 34 };
    const showC = { x: vw - 146, y: 34 };

    // Claim pointers landing on HUD controls so they don't move the player.
    for (const ptr of this.input.pointers.values()) {
      if (ptr.claimed !== undefined) continue;
      if (this.albumOpen) {
        ptr.claimed = 'album';
        if (this.albumDragId === null) {
          this.albumDragId = ptr.id;
          this.albumDragY = ptr.y;
          this.albumMoved = false;
        }
        continue;
      }
      if (Math.hypot(ptr.x - actionC.x, ptr.y - actionC.y) < ACTION_R + 6) {
        ptr.claimed = 'action';
        this.doAction();
      } else if (this.show.active) {
        // During the show, touches belong to the mini-game (except while leading the cow).
        ptr.claimed = this.show.playerMayMove ? '' : 'show';
        this.show.press();
      } else if (this.startPrompt && ptr.x > this.startPrompt.x && ptr.x < this.startPrompt.x + this.startPrompt.w && ptr.y > this.startPrompt.y - 6 && ptr.y < this.startPrompt.y + this.startPrompt.h + 6) {
        ptr.claimed = 'show';
        this.show.start(this.player, this.cows);
        this.hintLife = 0;
      } else if (Math.hypot(ptr.x - showC.x, ptr.y - showC.y) < BTN_R + 6) {
        ptr.claimed = 'show';
        this.goToShow();
      } else if (Math.hypot(ptr.x - albumC.x, ptr.y - albumC.y) < BTN_R + 6) {
        ptr.claimed = 'album';
        this.albumOpen = true;
        this.albumScroll = 0;
        this.albumDragId = ptr.id;
        this.albumDragY = ptr.y;
        this.albumMoved = true; // don't treat the opening press as a pick
      } else if (Math.hypot(ptr.x - soundC.x, ptr.y - soundC.y) < BTN_R + 6) {
        ptr.claimed = 'sound';
        this.sfx.setMuted(!this.sfx.muted);
      } else if (this.card && ptr.y < (vw < 620 ? 200 : 130) && (vw < 620 || (ptr.x > vw / 2 - 170 && ptr.x < vw / 2 + 170))) {
        ptr.claimed = 'card';
        this.card = null;
      } else {
        ptr.claimed = '';
      }
    }

    if (this.albumOpen) {
      const ptr = this.albumDragId !== null ? this.input.pointers.get(this.albumDragId) : undefined;
      if (ptr) {
        const dy = ptr.y - this.albumDragY;
        if (Math.abs(dy) > 6) this.albumMoved = true;
        this.albumScroll = clamp(this.albumScroll - dy, 0, this.albumMaxScroll());
        this.albumDragY = ptr.y;
      } else if (this.albumDragId !== null) {
        this.albumDragId = null;
      }
      for (const tap of this.input.consumeTaps()) this.albumTap(tap.x, tap.y);
      return;
    }

    // Joystick movement.
    const stick = this.input.stick();
    const p = this.player;
    if (stick && (Math.abs(stick.dx) > 0.05 || Math.abs(stick.dy) > 0.05)) {
      p.target = null;
      p.vx = stick.dx * p.def.speed;
      p.vy = stick.dy * p.def.speed * 0.7;
    } else if (!p.target) {
      p.vx = 0;
      p.vy = 0;
    }

    // Taps: pick an animal or walk somewhere.
    for (const tap of this.input.consumeTaps()) {
      const wx = tap.x + this.camX;
      const wy = tap.y - this.offY;
      let hit: Entity | null = null;
      for (const e of this.entities) {
        if (e.hitTest(wx, wy) && (!hit || e.y > hit.y)) hit = e;
      }
      if (hit && !this.show.active) {
        this.become(hit);
      } else if (wy > HORIZON - 30) {
        p.target = { x: clamp(wx, 20, WORLD_WIDTH - 20), y: clamp(wy, GROUND_TOP + 4, GROUND_BOTTOM) };
        this.effects.spawn('sparkle', p.target.x, p.target.y, 3, { color: '#ffffff', size: 3 });
      }
    }
  }

  // ---- album -----------------------------------------------------------------

  private albumLayout() {
    const cols = Math.max(3, Math.floor((this.viewW - 40) / 96));
    const cell = (this.viewW - 40) / cols;
    return { cols, cell, top: 64 };
  }

  private albumMaxScroll(): number {
    const { cols, cell, top } = this.albumLayout();
    const rows = Math.ceil(this.entities.length / cols);
    return Math.max(0, top + rows * (cell + 18) + 20 - this.viewH);
  }

  private albumTap(x: number, y: number): void {
    if (this.albumMoved) {
      this.albumMoved = false;
      return;
    }
    const vw = this.viewW;
    if (Math.hypot(x - (vw - 34), y - 34) < BTN_R + 8) {
      this.albumOpen = false;
      return;
    }
    const { cols, cell, top } = this.albumLayout();
    const col = Math.floor((x - 20) / cell);
    const row = Math.floor((y + this.albumScroll - top) / (cell + 18));
    if (col < 0 || col >= cols || row < 0) return;
    const idx = row * cols + col;
    const e = this.entities[idx];
    if (!e) return;
    this.albumOpen = false;
    this.become(e);
    this.camX = clamp(e.x - this.viewW / 2, 0, WORLD_WIDTH - this.viewW);
  }

  // ---- render ----------------------------------------------------------------

  private render(): void {
    const ctx = this.ctx;
    const dl = daylight(this.time);
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    ctx.imageSmoothingEnabled = true;

    // Portrait phones: extra sky above and grass below the 420 unit tall scene.
    if (this.offY > 0) {
      ctx.fillStyle = dl.skyTop;
      ctx.fillRect(0, 0, this.viewW, this.offY + 2);
      ctx.fillStyle = mixColor('#9ad25b', '#2c4d2a', (1 - dl.light) * 0.75);
      ctx.fillRect(0, this.offY + VIEW_H - 2, this.viewW, this.viewH - this.offY - VIEW_H + 2);
    }
    ctx.save();
    ctx.translate(0, this.offY);
    drawSky(ctx, this.viewW, this.camX, dl, this.time);
    drawGround(ctx, this.viewW, this.camX, dl);

    // Depth-sorted scene.
    const dark = 1 - dl.light;
    type Item = { y: number; draw: () => void };
    const items: Item[] = [];
    for (const pr of this.props) {
      if (pr.x + pr.w < this.camX - 50 || pr.x - pr.w > this.camX + this.viewW + 50) continue;
      items.push({
        y: pr.y,
        draw: () => {
          ctx.save();
          ctx.translate(pr.x - this.camX, pr.y);
          pr.draw(ctx, dark, this.time);
          ctx.restore();
        },
      });
    }
    for (const a of AREAS) {
      const sx = a.x0 + 30;
      if (sx < this.camX - 80 || sx > this.camX + this.viewW + 80) continue;
      items.push({
        y: GROUND_TOP + 22,
        draw: () => {
          ctx.save();
          ctx.translate(sx - this.camX, GROUND_TOP + 22);
          drawSign(ctx, a.label, dark);
          ctx.restore();
        },
      });
    }
    for (const egg of this.eggs) {
      items.push({
        y: egg.y,
        draw: () => {
          ctx.save();
          ctx.translate(egg.x - this.camX, egg.y);
          ctx.fillStyle = 'rgba(0,0,0,0.2)';
          ctx.beginPath();
          ctx.ellipse(0, 0, 6, 2.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff3d6';
          ctx.beginPath();
          ctx.ellipse(0, -5, 4.5, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(120,90,40,0.5)';
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.restore();
        },
      });
    }
    for (const e of this.entities) {
      const half = e.def.hit.w * e.scale + 80;
      if (e.x + half < this.camX || e.x - half > this.camX + this.viewW) continue;
      items.push({
        y: e.y,
        draw: () => {
          e.draw(ctx, this.time, this.camX);
          // Prize cows wear their latest rosette on the halter side.
          const won = e.def.species === 'cow' ? this.ribbonsOf(e.def.id) : [];
          if (won.length) drawRosette(ctx, e.x - this.camX + e.facing * 34 * e.scale, e.y - 52 * e.scale, 5 * e.scale, RIBBON_COLORS[won[won.length - 1]]);
        },
      });
    }
    // Show barn banners and the judge at the fair.
    if (this.camX + this.viewW > 4800) {
      items.push({
        y: GROUND_TOP + 5,
        draw: () => {
          ctx.save();
          ctx.translate(-this.camX, GROUND_TOP + 5);
          drawStallBanners(ctx, this.cows, (id) => this.ribbonsOf(id), dark);
          ctx.restore();
        },
      });
      const j = this.show.judge;
      items.push({
        y: j.y,
        draw: () => {
          ctx.save();
          ctx.translate(j.x - this.camX, j.y);
          const s = 0.9;
          ctx.scale(s * j.facing, s);
          drawFarmer(ctx, JUDGE, 7, { walk: j.walk, moving: j.moving, headDown: 0, chew: 0, tail: 0, ear: 0, blink: 0, t: this.time, action: 0 });
          ctx.restore();
        },
      });
    }
    items.sort((a, b) => a.y - b.y);
    for (const it of items) it.draw();

    // Player highlight ring under the controlled character.
    {
      const p = this.player;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(this.time * 4) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.ellipse(p.x - this.camX, p.y + 2, p.def.hit.w * p.scale * 0.95 + 6, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.save();
    ctx.translate(-this.camX, 0);
    this.show.drawWorld(ctx, this.time);
    this.effects.drawParticles(ctx);
    this.effects.drawBubbles(ctx);
    ctx.restore();

    // Night tint.
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(10,20,70,${dark * 0.42})`;
      ctx.fillRect(0, -this.offY, this.viewW, this.viewH);
    }
    ctx.restore();

    this.drawHud(dl.isNight);
    // Cow show prompt and overlays.
    const p = this.player;
    this.startPrompt = null;
    if (!this.show.active && !this.albumOpen && p.def.species === 'cow' && inRing(p.x, p.y) && this.show.cooldown <= 0) {
      this.startPrompt = drawStartPrompt(ctx, this.viewW, this.viewH, this.time);
    }
    if (this.showHint > 0 && !this.show.active) {
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const text = 'Only cows can enter the show. Tap a cow to become one!';
      const w = ctx.measureText(text).width + 30;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fill(roundRectPath(this.viewW / 2 - w / 2, this.viewH - 86, w, 32, 16));
      ctx.fillStyle = '#4a148c';
      ctx.fillText(text, this.viewW / 2, this.viewH - 70);
    }
    this.show.drawOverlay(ctx, this.viewW, this.viewH, (e) => portraitOf(e.def));
    if (this.albumOpen) this.drawAlbum();
  }

  private drawHud(night: boolean): void {
    const ctx = this.ctx;
    const vw = this.viewW;
    const vh = this.viewH;
    const p = this.player;

    // Joystick.
    const stick = this.input.stick();
    if (stick) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(stick.ax, stick.ay, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(stick.ax + stick.dx * 30, stick.ay + stick.dy * 30, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    // Character badge (top-left).
    const badge = roundRectPath(10, 10, 210, 54, 27);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fill(badge);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke(badge);
    ctx.save();
    ctx.beginPath();
    ctx.arc(37, 37, 23, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#c5e1a5';
    ctx.fillRect(14, 14, 46, 46);
    ctx.drawImage(portraitOf(p.def), 14, 14, 46, 46);
    ctx.restore();
    ctx.fillStyle = '#263238';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.def.name, 68, 29);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#546e7a';
    ctx.fillText(p.def.breed, 68, 47);

    // Egg counter.
    if (this.eggCount > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill(roundRectPath(10, 70, 74, 26, 13));
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.ellipse(24, 83, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,40,0.5)';
      ctx.stroke();
      ctx.fillStyle = '#263238';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`x ${this.eggCount}`, 38, 84);
    }

    // Cow show shortcut (rosette), album and sound buttons (top-right).
    this.drawRoundButton(vw - 146, 34, BTN_R, '#7e57c2');
    drawRosette(ctx, vw - 146, 31, 11, '#ffd54f');
    const myRibbons = this.ribbonsOf(p.def.id);
    if (myRibbons.length) {
      myRibbons.slice(-4).forEach((rb, i) => drawRosette(ctx, 76 + i * 14, 58, 5, RIBBON_COLORS[rb]));
    }
    // Album + sound buttons (top-right).
    this.drawRoundButton(vw - 34, 34, BTN_R, '#ffb74d');
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(vw - 44, 24, 9, 20);
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(vw - 34, 24, 10, 20);
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vw - 44, 24, 20, 20);
    this.drawRoundButton(vw - 90, 34, BTN_R, this.sfx.muted ? '#cfd8dc' : '#81d4fa');
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.moveTo(vw - 100, 30);
    ctx.lineTo(vw - 94, 30);
    ctx.lineTo(vw - 86, 23);
    ctx.lineTo(vw - 86, 45);
    ctx.lineTo(vw - 94, 38);
    ctx.lineTo(vw - 100, 38);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 2;
    if (this.sfx.muted) {
      ctx.beginPath();
      ctx.moveTo(vw - 82, 28);
      ctx.lineTo(vw - 74, 40);
      ctx.moveTo(vw - 74, 28);
      ctx.lineTo(vw - 82, 40);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(vw - 84, 34, 6, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(vw - 84, 34, 11, -0.9, 0.9);
      ctx.stroke();
    }

    // Action button (bottom-right) with the character's word.
    const pressed = [...this.input.pointers.values()].some((q) => q.claimed === 'action');
    const r = pressed ? ACTION_R - 3 : ACTION_R;
    this.drawRoundButton(vw - 54, vh - 54, r, '#ff7043');
    ctx.fillStyle = '#fff';
    const word = p.def.word.length > 8 ? p.def.word.split(/[- ]/)[0] : p.def.word;
    ctx.font = `bold ${word.length > 5 ? 14 : 18}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(word, vw - 54, vh - 54);

    // First-time hint.
    if (this.hintLife > 0 && this.becomes === 0 && !this.show.active) {
      const a = clamp(this.hintLife, 0, 1);
      ctx.globalAlpha = a;
      const text = 'Tap any animal to become it!  Drag to walk.';
      ctx.font = 'bold 15px sans-serif';
      const w = ctx.measureText(text).width + 30;
      const y = vh - 40 + Math.sin(this.time * 3) * 3;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill(roundRectPath(vw / 2 - w / 2 - 60, y - 16, w, 32, 16));
      ctx.fillStyle = '#263238';
      ctx.fillText(text, vw / 2 - 60, y);
      ctx.globalAlpha = 1;
    }

    // Night label.
    if (night) {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Shh... the animals are sleeping', vw / 2, 22);
    }

    // Info card after becoming someone.
    if (this.card) {
      const c = this.card;
      const pop = Math.min(1, c.life / 0.35);
      const ease = 1 - Math.pow(1 - pop, 3);
      const fade = c.life > 7 ? 1 - (c.life - 7) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      const narrow = vw < 620;
      const cw = narrow ? vw - 24 : Math.min(360, vw - 250);
      const cx = vw / 2 - cw / 2;
      const cy = (narrow ? 74 : 12) - (1 - ease) * 80;
      const lines = wrap(ctx, c.def.fact, cw - 100, '13px sans-serif');
      const ch = 44 + lines.length * 16;
      const path = roundRectPath(cx, cy, cw, ch, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.fill(path);
      ctx.strokeStyle = '#ffb74d';
      ctx.lineWidth = 3;
      ctx.stroke(path);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx + 38, cy + ch / 2, 30, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = '#c5e1a5';
      ctx.fillRect(cx + 8, cy + ch / 2 - 30, 60, 60);
      ctx.drawImage(portraitOf(c.def), cx + 8, cy + ch / 2 - 30, 60, 60);
      ctx.restore();
      ctx.fillStyle = '#263238';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`You are ${c.def.name} the ${c.def.breed}!`, cx + 80, cy + 12);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#455a64';
      lines.forEach((l, i) => ctx.fillText(l, cx + 80, cy + 34 + i * 16));
      ctx.restore();
    }
  }

  private drawRoundButton(x: number, y: number, r: number, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(x, y + 3, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  private drawAlbum(): void {
    const ctx = this.ctx;
    const vw = this.viewW;
    const vh = this.viewH;
    ctx.fillStyle = 'rgba(46,90,55,0.94)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Farm Friends: who do you want to be?', 20, 32);
    this.drawRoundButton(vw - 34, 34, BTN_R, '#ef5350');
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(vw - 42, 26);
    ctx.lineTo(vw - 26, 42);
    ctx.moveTo(vw - 26, 26);
    ctx.lineTo(vw - 42, 42);
    ctx.stroke();

    const { cols, cell, top } = this.albumLayout();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top - 4, vw, vh - top + 4);
    ctx.clip();
    this.entities.forEach((e, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 20 + col * cell;
      const y = top + row * (cell + 18) - this.albumScroll;
      if (y + cell + 18 < top || y > vh) return;
      const size = cell - 10;
      const card = roundRectPath(x + 5, y, size, size + 14, 12);
      ctx.fillStyle = e === this.player ? '#fff3c4' : 'rgba(255,255,255,0.92)';
      ctx.fill(card);
      if (e === this.player) {
        ctx.strokeStyle = '#ffb300';
        ctx.lineWidth = 3;
        ctx.stroke(card);
      }
      ctx.drawImage(portraitOf(e.def), x + 5 + size * 0.1, y + 2, size * 0.8, size * 0.8);
      ctx.fillStyle = '#263238';
      ctx.font = `bold ${size > 90 ? 12 : 10}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(e.def.name, x + 5 + size / 2, y + size - 4);
      ctx.font = `${size > 90 ? 10 : 8}px sans-serif`;
      ctx.fillStyle = '#607d8b';
      ctx.fillText(e.def.breed, x + 5 + size / 2, y + size + 7, size - 6);
      const won = this.ribbonsOf(e.def.id).slice(-3);
      won.forEach((rb, k) => drawRosette(ctx, x + 14 + k * 12, y + 8, 4.5, RIBBON_COLORS[rb]));
    });
    ctx.restore();
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, font: string): string[] {
  ctx.font = font;
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

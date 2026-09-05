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
import { Platform, isIOS, isStandalone } from '../platform';
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
  private platform = new Platform();
  private paused = false;
  private installHintLife = 0;
  private installHintShown = false;
  private rotateHint = 6;
  private toast = '';
  private toastLife = 0;
  private capturing = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.input = new Input(canvas, (px, py) => this.toLogical(px, py));
    this.input.onFirstInteraction = () => {
      this.sfx.unlock();
      this.platform.onFirstGesture();
    };
    this.platform.onVisibility((visible) => {
      this.paused = !visible;
      if (visible) this.last = performance.now();
      this.sfx.setEngine(false, 0);
    });
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
      if (!this.paused) {
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        this.update(dt);
        this.render();
      } else {
        this.last = now;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ---- HUD layout (respects the iPhone notch and home indicator) ---------------------

  private layout() {
    const s = this.scale;
    const L = this.platform.insets.left / s;
    const R = this.platform.insets.right / s;
    const T = this.platform.insets.top / s;
    const B = this.platform.insets.bottom / s;
    const vw = this.viewW;
    const vh = this.viewH;
    const bottomRow = vh - 34 - B;
    return {
      L,
      R,
      T,
      B,
      badge: { x: 10 + L, y: 10 + T },
      action: { x: vw - 54 - R, y: vh - 54 - B },
      album: { x: vw - 34 - R, y: 34 + T },
      sound: { x: vw - 90 - R, y: 34 + T },
      show: { x: vw - 146 - R, y: 34 + T },
      photo: { x: 34 + L, y: bottomRow },
      tilt: { x: 90 + L, y: bottomRow },
      install: this.platform.canPromptInstall ? { x: 146 + L, y: bottomRow } : null,
    };
  }

  private say(text: string): void {
    this.toast = text;
    this.toastLife = 3;
  }

  /** Snapshot the farm (without the HUD) and hand it to the share sheet. */
  private async takePhoto(): Promise<void> {
    this.capturing = true;
    this.render();
    const ctx = this.ctx;
    ctx.setTransform(this.dpr * this.scale, 0, 0, this.dpr * this.scale, 0, 0);
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    const label = `${this.player.def.name} the ${this.player.def.breed}  •  Farm Friends`;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, this.viewH - 34, ctx.measureText(label).width + 28, 34);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, 14, this.viewH - 9);
    this.capturing = false;
    this.effects.spawn('sparkle', this.player.x, this.player.y - 40, 10, { color: '#ffffff' });
    this.sfx.ding();
    const ok = await this.platform.sharePhoto(this.canvas, `${this.player.def.name} on Farm Friends`);
    this.say(ok ? 'Photo ready!' : 'Could not share the photo');
  }

  private async toggleTilt(): Promise<void> {
    if (this.platform.tilt.enabled) {
      this.platform.disableTilt();
      this.say('Tilt steering off');
      return;
    }
    const ok = await this.platform.enableTilt();
    this.say(ok ? 'Tilt your phone to walk!' : 'Tilt steering is not available');
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

  debugShowInstallHint(): void {
    this.installHintLife = 14;
  }

  /** Platform summary for the console: helps when testing on a real iPhone. */
  get platformInfo(): string {
    return `iOS=${isIOS} standalone=${isStandalone()} share=${this.platform.canShare} tilt=${this.platform.tilt.supported} insets=${JSON.stringify(this.platform.insets)}`;
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
    this.toastLife = Math.max(0, this.toastLife - dt);
    this.rotateHint = Math.max(0, this.rotateHint - dt);
    if (this.installHintLife > 0) this.installHintLife -= dt;
    // After a little play on iPhone Safari, suggest adding the game to the Home Screen.
    if (!this.installHintShown && this.time > 30 + 75 && this.platform.shouldShowIOSInstallHint && !this.show.active) {
      this.installHintShown = true;
      this.installHintLife = 14;
    }

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
    const lay = this.layout();
    const actionC = lay.action;
    const albumC = lay.album;
    const soundC = lay.sound;
    const showC = lay.show;

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
      } else if (Math.hypot(ptr.x - lay.photo.x, ptr.y - lay.photo.y) < BTN_R + 6) {
        ptr.claimed = 'photo';
        void this.takePhoto();
      } else if (Math.hypot(ptr.x - lay.tilt.x, ptr.y - lay.tilt.y) < BTN_R + 6) {
        ptr.claimed = 'tilt';
        void this.toggleTilt();
      } else if (lay.install && Math.hypot(ptr.x - lay.install.x, ptr.y - lay.install.y) < BTN_R + 6) {
        ptr.claimed = 'install';
        void this.platform.promptInstall();
      } else if (this.installHintLife > 0 && ptr.y > vh - 96 - lay.B && ptr.x > vw / 2 - 190 && ptr.x < vw / 2 + 190) {
        ptr.claimed = 'install-hint';
        this.installHintLife = 0;
        this.platform.dismissIOSInstallHint();
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

    // Joystick movement, or tilt steering when switched on.
    const stick = this.input.stick();
    const p = this.player;
    const tilt = this.platform.tilt;
    if (stick && (Math.abs(stick.dx) > 0.05 || Math.abs(stick.dy) > 0.05)) {
      p.target = null;
      p.vx = stick.dx * p.def.speed;
      p.vy = stick.dy * p.def.speed * 0.7;
    } else if (tilt.enabled && (tilt.x !== 0 || tilt.y !== 0) && (!this.show.active || this.show.playerMayMove)) {
      p.target = null;
      p.vx = tilt.x * p.def.speed;
      p.vy = tilt.y * p.def.speed * 0.7;
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
    const lay = this.layout();
    if (Math.hypot(x - lay.album.x, y - lay.album.y) < BTN_R + 8) {
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

    if (this.capturing) return;
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
    const lay = this.layout();

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
    const bx = lay.badge.x;
    const by = lay.badge.y;
    const badge = roundRectPath(bx, by, 210, 54, 27);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fill(badge);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke(badge);
    ctx.save();
    ctx.beginPath();
    ctx.arc(bx + 27, by + 27, 23, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#c5e1a5';
    ctx.fillRect(bx + 4, by + 4, 46, 46);
    ctx.drawImage(portraitOf(p.def), bx + 4, by + 4, 46, 46);
    ctx.restore();
    ctx.fillStyle = '#263238';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.def.name, bx + 58, by + 19);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#546e7a';
    ctx.fillText(p.def.breed, bx + 58, by + 37);

    // Egg counter.
    if (this.eggCount > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fill(roundRectPath(bx, by + 60, 74, 26, 13));
      ctx.fillStyle = '#fff3d6';
      ctx.beginPath();
      ctx.ellipse(bx + 14, by + 73, 6, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,40,0.5)';
      ctx.stroke();
      ctx.fillStyle = '#263238';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`x ${this.eggCount}`, bx + 28, by + 74);
    }

    // Cow show shortcut (rosette), sound and album buttons (top-right).
    this.drawRoundButton(lay.show.x, lay.show.y, BTN_R, '#7e57c2');
    drawRosette(ctx, lay.show.x, lay.show.y - 3, 11, '#ffd54f');
    const myRibbons = this.ribbonsOf(p.def.id);
    if (myRibbons.length) {
      myRibbons.slice(-4).forEach((rb, i) => drawRosette(ctx, bx + 66 + i * 14, by + 48, 5, RIBBON_COLORS[rb]));
    }
    const ab = lay.album;
    this.drawRoundButton(ab.x, ab.y, BTN_R, '#ffb74d');
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(ab.x - 10, ab.y - 10, 9, 20);
    ctx.fillStyle = '#8d6e63';
    ctx.fillRect(ab.x, ab.y - 10, 10, 20);
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ab.x - 10, ab.y - 10, 20, 20);
    const sb = lay.sound;
    this.drawRoundButton(sb.x, sb.y, BTN_R, this.sfx.muted ? '#cfd8dc' : '#81d4fa');
    ctx.fillStyle = '#263238';
    ctx.beginPath();
    ctx.moveTo(sb.x - 10, sb.y - 4);
    ctx.lineTo(sb.x - 4, sb.y - 4);
    ctx.lineTo(sb.x + 4, sb.y - 11);
    ctx.lineTo(sb.x + 4, sb.y + 11);
    ctx.lineTo(sb.x - 4, sb.y + 4);
    ctx.lineTo(sb.x - 10, sb.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 2;
    if (this.sfx.muted) {
      ctx.beginPath();
      ctx.moveTo(sb.x + 8, sb.y - 6);
      ctx.lineTo(sb.x + 16, sb.y + 6);
      ctx.moveTo(sb.x + 16, sb.y - 6);
      ctx.lineTo(sb.x + 8, sb.y + 6);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(sb.x + 6, sb.y, 6, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sb.x + 6, sb.y, 11, -0.9, 0.9);
      ctx.stroke();
    }

    // Photo (share sheet) and tilt steering buttons (bottom-left), install when offered.
    const ph = lay.photo;
    this.drawRoundButton(ph.x, ph.y, BTN_R, '#26a69a');
    ctx.fillStyle = '#fff';
    ctx.fill(roundRectPath(ph.x - 12, ph.y - 7, 24, 16, 3));
    ctx.fillRect(ph.x - 5, ph.y - 11, 10, 5);
    ctx.fillStyle = '#26a69a';
    ctx.beginPath();
    ctx.arc(ph.x, ph.y + 1, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ph.x, ph.y + 1, 2.5, 0, Math.PI * 2);
    ctx.fill();
    const tb = lay.tilt;
    const tiltOn = this.platform.tilt.enabled;
    this.drawRoundButton(tb.x, tb.y, BTN_R, tiltOn ? '#ffca28' : '#b0bec5');
    ctx.save();
    ctx.translate(tb.x, tb.y);
    ctx.rotate(tiltOn ? Math.sin(this.time * 3) * 0.35 : -0.35);
    ctx.fillStyle = '#263238';
    ctx.fill(roundRectPath(-7, -12, 14, 24, 3));
    ctx.fillStyle = '#e0f7fa';
    ctx.fillRect(-5, -9, 10, 16);
    ctx.restore();
    if (lay.install) {
      const ib = lay.install;
      this.drawRoundButton(ib.x, ib.y, BTN_R, '#66bb6a');
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ib.x, ib.y - 11);
      ctx.lineTo(ib.x, ib.y + 5);
      ctx.moveTo(ib.x - 7, ib.y - 2);
      ctx.lineTo(ib.x, ib.y + 5);
      ctx.lineTo(ib.x + 7, ib.y - 2);
      ctx.moveTo(ib.x - 10, ib.y + 11);
      ctx.lineTo(ib.x + 10, ib.y + 11);
      ctx.stroke();
    }

    // Action button (bottom-right) with the character's word.
    const pressed = [...this.input.pointers.values()].some((q) => q.claimed === 'action');
    const r = pressed ? ACTION_R - 3 : ACTION_R;
    const ac = lay.action;
    this.drawRoundButton(ac.x, ac.y, r, '#ff7043');
    ctx.fillStyle = '#fff';
    const word = p.def.word.length > 8 ? p.def.word.split(/[- ]/)[0] : p.def.word;
    ctx.font = `bold ${word.length > 5 ? 14 : 18}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(word, ac.x, ac.y);

    // Toasts, rotate hint and the iPhone "Add to Home Screen" card.
    if (this.toastLife > 0) {
      ctx.globalAlpha = Math.min(1, this.toastLife);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(this.toast).width + 28;
      ctx.fillStyle = 'rgba(38,50,56,0.9)';
      ctx.fill(roundRectPath(vw / 2 - w / 2, 88 + lay.T, w, 30, 15));
      ctx.fillStyle = '#fff';
      ctx.fillText(this.toast, vw / 2, 103 + lay.T);
      ctx.globalAlpha = 1;
    }
    if (this.rotateHint > 0 && vw < vh) {
      ctx.globalAlpha = Math.min(1, this.rotateHint);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      const text = 'Turn your phone sideways for the best view';
      const w = ctx.measureText(text).width + 28;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fill(roundRectPath(vw / 2 - w / 2, 130 + lay.T, w, 30, 15));
      ctx.fillStyle = '#263238';
      ctx.fillText(text, vw / 2, 145 + lay.T);
      ctx.globalAlpha = 1;
    }
    if (this.installHintLife > 0) {
      const a = Math.min(1, this.installHintLife);
      ctx.globalAlpha = a;
      const w = Math.min(380, vw - 24);
      const h = 64;
      const x = vw / 2 - w / 2;
      const y = vh - h - 20 - lay.B;
      const card = roundRectPath(x, y, w, h, 16);
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.fill(card);
      ctx.strokeStyle = '#26a69a';
      ctx.lineWidth = 3;
      ctx.stroke(card);
      ctx.drawImage(portraitOf(p.def), x + 8, y + 8, 48, 48);
      ctx.fillStyle = '#263238';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Add Farm Friends to your Home Screen', x + 64, y + 20);
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#455a64';
      ctx.fillText('Tap the Share button, then "Add to Home Screen".', x + 64, y + 40);
      // share icon
      ctx.strokeStyle = '#1e88e5';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w - 24, y + 22);
      ctx.lineTo(x + w - 24, y + 42);
      ctx.moveTo(x + w - 30, y + 28);
      ctx.lineTo(x + w - 24, y + 22);
      ctx.lineTo(x + w - 18, y + 28);
      ctx.stroke();
      ctx.strokeRect(x + w - 34, y + 32, 20, 18);
      ctx.fillStyle = '#90a4ae';
      ctx.font = '11px sans-serif';
      ctx.fillText('tap to close', x + 64, y + 56);
      ctx.globalAlpha = 1;
    }

    // First-time hint.
    if (this.hintLife > 0 && this.becomes === 0 && !this.show.active && this.installHintLife <= 0) {
      const a = clamp(this.hintLife, 0, 1);
      ctx.globalAlpha = a;
      const text = 'Tap any animal to become it!  Drag to walk.';
      ctx.font = 'bold 15px sans-serif';
      const w = ctx.measureText(text).width + 30;
      const y = vh - 40 - lay.B + Math.sin(this.time * 3) * 3;
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
    const lay = this.layout();
    ctx.fillText('Farm Friends: who do you want to be?', 20 + lay.L, 32 + lay.T);
    this.drawRoundButton(lay.album.x, lay.album.y, BTN_R, '#ef5350');
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lay.album.x - 8, lay.album.y - 8);
    ctx.lineTo(lay.album.x + 8, lay.album.y + 8);
    ctx.moveTo(lay.album.x + 8, lay.album.y - 8);
    ctx.lineTo(lay.album.x - 8, lay.album.y + 8);
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

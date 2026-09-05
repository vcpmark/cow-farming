/**
 * A character living in the world. When not controlled by the player it wanders
 * around its home area, grazes, naps at night and occasionally makes its sound.
 */
import type { Pose } from './art/common';
import { drawGroundShadow } from './art/cowArt';
import type { CharacterDef } from './characters';
import { clamp, lerp } from './util';
import { GROUND_BOTTOM, GROUND_TOP, POND, depthScale, inMud, inPond } from './world';

export type AiState = 'idle' | 'walk' | 'graze' | 'sleep';

export interface Target {
  x: number;
  y: number;
}

export class Entity {
  x: number;
  y: number;
  facing: 1 | -1 = 1;
  vx = 0;
  vy = 0;
  controlled = false;
  target: Target | null = null;

  // animation state
  walk = 0;
  moving = 0;
  headDown = 0;
  chew = 0;
  tail = 0;
  ear = 0;
  blink = 0;
  action = 0;
  private blinkTimer = 2;
  private earTimer = 3;

  // ai
  ai: AiState = 'idle';
  aiTimer = 1;
  private grazeWish = 0;
  soundTimer = 6 + Math.random() * 14;
  private zzzTimer = 0;
  private grazeTimer = 0;

  constructor(
    public def: CharacterDef,
    x: number,
    y: number,
  ) {
    this.x = x;
    this.y = y;
    this.aiTimer = Math.random() * 3;
    this.facing = Math.random() < 0.5 ? 1 : -1;
  }

  get scale(): number {
    return depthScale(this.y) * this.def.scale;
  }

  get swimming(): boolean {
    return !!this.def.swims && inPond(this.x, this.y);
  }

  get canGraze(): boolean {
    if (!this.def.grazes) return false;
    if (inPond(this.x, this.y) || inMud(this.x, this.y)) return false;
    return !(this.y > 362 && this.y < 392); // the dirt path
  }

  /** Start a grazing bout for a few seconds (used by the action button too). */
  graze(seconds: number): void {
    this.grazeTimer = seconds;
  }

  triggerAction(): void {
    this.action = 1;
  }

  pose(time: number): Pose {
    return {
      walk: this.walk,
      moving: this.moving,
      headDown: this.headDown,
      chew: this.chew,
      tail: this.tail,
      ear: this.ear,
      blink: this.blink,
      t: time + this.def.seed * 0.001,
      action: this.action,
    };
  }

  hitTest(wx: number, wy: number): boolean {
    const s = this.scale;
    const { w, h } = this.def.hit;
    return Math.abs(wx - this.x) < w * s + 6 && wy > this.y - h * s - 6 && wy < this.y + 10;
  }

  /** Called every frame. `night` puts uncontrolled animals to sleep. */
  update(dt: number, time: number, night: boolean, spawnZ: (x: number, y: number) => void): void {
    const speed = this.def.speed;

    if (this.controlled) {
      this.ai = 'idle';
      if (this.target) {
        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const d = Math.hypot(dx, dy);
        if (d < 6) {
          this.target = null;
          this.vx = 0;
          this.vy = 0;
        } else {
          this.vx = (dx / d) * speed;
          this.vy = (dy / d) * speed * 0.7;
        }
      }
    } else if (night && this.def.species !== 'tractor') {
      this.ai = 'sleep';
      this.vx = 0;
      this.vy = 0;
      this.zzzTimer -= dt;
      if (this.zzzTimer <= 0) {
        this.zzzTimer = 1.6 + Math.random() * 1.5;
        spawnZ(this.x, this.y - this.def.hit.h * this.scale * 0.8);
      }
    } else {
      this.updateAi(dt, speed);
    }

    // integrate
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.y = clamp(this.y, GROUND_TOP + 4, GROUND_BOTTOM);
    if (Math.abs(this.vx) > 1) this.facing = this.vx > 0 ? 1 : -1;
    const spd = Math.hypot(this.vx, this.vy);
    const movingTarget = spd > 2 ? clamp(spd / speed, 0.5, 1) : 0;
    this.moving = lerp(this.moving, movingTarget, 1 - Math.pow(0.001, dt));
    if (spd > 2) this.walk += dt * (this.def.species === 'tractor' ? spd * 0.12 : 4 + (spd / speed) * 6);

    // grazing (either the AI decided, or the player pressed the action button)
    if (this.grazeTimer > 0) this.grazeTimer -= dt;
    const grazing = (this.ai === 'graze' || this.grazeTimer > 0) && spd < 2 && this.canGraze;
    const sleeping = this.ai === 'sleep';
    this.headDown = lerp(this.headDown, grazing ? 1 : sleeping ? 0.35 : 0, 1 - Math.pow(0.02, dt));
    this.chew = grazing ? 0.5 + 0.5 * Math.sin(time * 9) : lerp(this.chew, 0, 1 - Math.pow(0.05, dt));

    // blink & ear flicks
    this.blinkTimer -= dt;
    if (sleeping) this.blink = lerp(this.blink, 1, 1 - Math.pow(0.05, dt));
    else if (this.blinkTimer <= 0) {
      this.blink = 1;
      this.blinkTimer = 2 + Math.random() * 4;
    } else this.blink = Math.max(0, this.blink - dt * 8);
    this.earTimer -= dt;
    if (this.earTimer <= 0) {
      this.ear = 1;
      this.earTimer = 3 + Math.random() * 5;
    } else this.ear = Math.max(0, this.ear - dt * 4);
    this.tail = Math.sin(time * 1.7 + this.def.seed) * 0.5 * (0.3 + this.moving);

    this.action = Math.max(0, this.action - dt * 1.6);
    this.soundTimer -= dt;
  }

  private updateAi(dt: number, speed: number): void {
    this.aiTimer -= dt;
    const [h0, h1] = this.def.home;
    if (this.ai === 'walk' && this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 6 || this.aiTimer <= 0) {
        this.target = null;
        this.vx = 0;
        this.vy = 0;
        this.ai = this.grazeWish > 0.5 && this.canGraze ? 'graze' : 'idle';
        this.aiTimer = this.ai === 'graze' ? 3 + Math.random() * 5 : 1 + Math.random() * 3;
      } else {
        const wander = this.def.species === 'tractor' ? 0.35 : 0.45;
        this.vx = (dx / d) * speed * wander;
        this.vy = (dy / d) * speed * wander * 0.7;
      }
      return;
    }
    this.vx = 0;
    this.vy = 0;
    if (this.aiTimer <= 0) {
      // choose a new destination
      let tx = lerp(h0, h1, Math.random());
      let ty = lerp(GROUND_TOP + 6, GROUND_BOTTOM, Math.random());
      if (this.def.swims && Math.random() < 0.6) {
        tx = POND.x + (Math.random() - 0.5) * POND.rx * 1.4;
        ty = POND.y + (Math.random() - 0.5) * POND.ry * 1.4;
      }
      if (this.def.species === 'pig' && Math.random() < 0.4) {
        tx = 2820 + (Math.random() - 0.5) * 120;
        ty = 360 + (Math.random() - 0.5) * 30;
      }
      this.target = { x: tx, y: ty };
      this.grazeWish = Math.random();
      this.ai = 'walk';
      this.aiTimer = 6 + Math.random() * 6;
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number, camX: number): void {
    const s = this.scale;
    ctx.save();
    ctx.translate(this.x - camX, this.y);
    ctx.scale(s, s);
    const swimming = this.swimming;
    if (!swimming) drawGroundShadow(ctx, this.def.hit.w * 0.9, 0.2);
    ctx.scale(this.facing, 1);
    this.def.draw(ctx, this.pose(time), swimming);
    ctx.restore();
    if (swimming) {
      // ripples
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(this.x - camX, this.y + 6, 22 * s + Math.sin(time * 3) * 2, 6 * s, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

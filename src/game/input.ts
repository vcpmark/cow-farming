/**
 * Touch / mouse input. A drag anywhere on the ground becomes a floating
 * joystick; a quick tap is reported separately so the game can use it to
 * pick an animal or walk somewhere.
 */
export interface Pointer {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
  /** Set by the game when a pointer is captured by a HUD control. */
  claimed?: string;
}

export interface Tap {
  x: number;
  y: number;
  /** Which HUD control (if any) claimed the pointer when it went down; '' for the world. */
  claimed: string;
}

export class Input {
  pointers = new Map<number, Pointer>();
  taps: Tap[] = [];
  /** The pointer currently driving movement, if any. */
  stickId: number | null = null;
  onFirstInteraction: (() => void) | null = null;
  /** Called synchronously on every pointer down so HUD controls react to the press itself. */
  onDown: ((p: Pointer) => void) | null = null;
  private interacted = false;

  constructor(private canvas: HTMLCanvasElement, private toLogical: (px: number, py: number) => [number, number]) {
    canvas.addEventListener('pointerdown', this.down, { passive: false });
    canvas.addEventListener('pointermove', this.move, { passive: false });
    canvas.addEventListener('pointerup', this.up, { passive: false });
    canvas.addEventListener('pointercancel', this.up, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private down = (e: PointerEvent): void => {
    e.preventDefault();
    if (!this.interacted) {
      this.interacted = true;
      this.onFirstInteraction?.();
    }
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* not all browsers */
    }
    const [x, y] = this.toLogical(e.clientX, e.clientY);
    const p: Pointer = { id: e.pointerId, x, y, startX: x, startY: y, startTime: performance.now(), moved: false };
    this.pointers.set(e.pointerId, p);
    this.onDown?.(p);
  };

  private move = (e: PointerEvent): void => {
    e.preventDefault();
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const [x, y] = this.toLogical(e.clientX, e.clientY);
    p.x = x;
    p.y = y;
    if (Math.hypot(x - p.startX, y - p.startY) > 10) p.moved = true;
  };

  private up = (e: PointerEvent): void => {
    e.preventDefault();
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    if (!p.moved && performance.now() - p.startTime < 400) {
      this.taps.push({ x: p.startX, y: p.startY, claimed: p.claimed ?? '' });
    }
    this.pointers.delete(e.pointerId);
    if (this.stickId === e.pointerId) this.stickId = null;
  };

  /** Movement vector (-1..1) from the joystick pointer, or null. */
  stick(radius = 46): { dx: number; dy: number; ax: number; ay: number } | null {
    if (this.stickId === null) {
      for (const p of this.pointers.values()) {
        if (!p.claimed && p.moved) {
          this.stickId = p.id;
          break;
        }
      }
    }
    if (this.stickId === null) return null;
    const p = this.pointers.get(this.stickId);
    if (!p) {
      this.stickId = null;
      return null;
    }
    let dx = (p.x - p.startX) / radius;
    let dy = (p.y - p.startY) / radius;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    return { dx, dy, ax: p.startX, ay: p.startY };
  }

  consumeTaps(): Tap[] {
    const t = this.taps;
    this.taps = [];
    return t;
  }
}

/**
 * Web platform features that make the game feel like a real iPhone app:
 * service worker for offline play, home screen install, safe-area insets,
 * screen wake lock, orientation lock, Web Share photos, tilt steering and
 * pausing while hidden. Everything degrades gracefully when unsupported.
 */
import { registerSW } from 'virtual:pwa-register';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type OrientationLock = { lock?: (o: string) => Promise<void> };

const ua = navigator.userAgent;
export const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);
export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

export class Platform {
  insets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
  private installEvent: BeforeInstallPromptEvent | null = null;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private wakeWanted = false;
  private visibilityListeners: ((visible: boolean) => void)[] = [];
  /** Tilt steering state, -1..1 on each axis once enabled. */
  tilt = { supported: 'DeviceOrientationEvent' in window, enabled: false, x: 0, y: 0 };
  private tiltBase: { beta: number; gamma: number } | null = null;

  constructor() {
    this.readInsets();
    window.addEventListener('resize', () => this.readInsets());
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installEvent = e as BeforeInstallPromptEvent;
    });
    window.addEventListener('appinstalled', () => (this.installEvent = null));
    document.addEventListener('visibilitychange', () => {
      const visible = document.visibilityState === 'visible';
      for (const l of this.visibilityListeners) l(visible);
      if (visible && this.wakeWanted) void this.requestWakeLock();
      if (!visible) {
        window.speechSynthesis?.cancel();
        void this.wakeLock?.release().catch(() => undefined);
        this.wakeLock = null;
      }
    });
    // Offline support and updates: the service worker precaches the whole game.
    try {
      registerSW({ immediate: true });
    } catch {
      /* not available in dev or unsupported browsers */
    }
    // Ask the browser to keep our saved ribbons and settings around.
    void navigator.storage?.persist?.().catch(() => false);
  }

  private readInsets(): void {
    const el = document.getElementById('safe-area');
    if (!el) return;
    const cs = getComputedStyle(el);
    const px = (v: string) => parseFloat(v) || 0;
    this.insets = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
  }

  onVisibility(cb: (visible: boolean) => void): void {
    this.visibilityListeners.push(cb);
  }

  /** Call from the first user gesture: wake lock and orientation lock both need one. */
  onFirstGesture(): void {
    this.wakeWanted = true;
    void this.requestWakeLock();
    const so = (screen as unknown as { orientation?: OrientationLock }).orientation;
    if (so?.lock && isStandalone()) {
      so.lock('landscape').catch(() => {
        /* iOS Safari does not allow locking; the layout adapts instead */
      });
    }
  }

  private async requestWakeLock(): Promise<void> {
    const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    if (!wl) return;
    try {
      this.wakeLock = await wl.request('screen');
    } catch {
      this.wakeLock = null;
    }
  }

  /** True when the browser offered an install prompt we can trigger. */
  get canPromptInstall(): boolean {
    return this.installEvent !== null;
  }

  /** iPhone Safari has no install prompt; we show manual "Add to Home Screen" steps instead. */
  get shouldShowIOSInstallHint(): boolean {
    if (!isIOS || isStandalone()) return false;
    try {
      return localStorage.getItem('farm-install-hint') !== 'dismissed';
    } catch {
      return true;
    }
  }

  dismissIOSInstallHint(): void {
    try {
      localStorage.setItem('farm-install-hint', 'dismissed');
    } catch {
      /* ignore */
    }
  }

  async promptInstall(): Promise<void> {
    const ev = this.installEvent;
    if (!ev) return;
    this.installEvent = null;
    try {
      await ev.prompt();
      await ev.userChoice;
    } catch {
      /* user dismissed */
    }
  }

  get canShare(): boolean {
    const n = navigator as unknown as { share?: unknown; canShare?: (d: { files: File[] }) => boolean };
    return typeof n.share === 'function';
  }

  /** Share a snapshot of the canvas through the iPhone share sheet (Photos, Messages, AirDrop...). */
  async sharePhoto(canvas: HTMLCanvasElement, title: string): Promise<boolean> {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) return false;
    const file = new File([blob], 'farm-friends.png', { type: 'image/png' });
    const n = navigator as unknown as {
      share?: (d: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      canShare?: (d: { files: File[] }) => boolean;
    };
    try {
      if (n.share && (!n.canShare || n.canShare({ files: [file] }))) {
        await n.share({ files: [file], title, text: title });
        return true;
      }
    } catch {
      /* cancelled or unsupported: fall through to download */
    }
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'farm-friends.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return true;
    } catch {
      return false;
    }
  }

  /** Enable tilt steering. On iPhone this asks for motion permission (must run from a tap). */
  async enableTilt(): Promise<boolean> {
    if (!this.tilt.supported) return false;
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> };
    try {
      if (typeof DOE.requestPermission === 'function') {
        const r = await DOE.requestPermission();
        if (r !== 'granted') return false;
      }
    } catch {
      return false;
    }
    this.tiltBase = null;
    window.addEventListener('deviceorientation', this.onOrientation);
    this.tilt.enabled = true;
    return true;
  }

  disableTilt(): void {
    window.removeEventListener('deviceorientation', this.onOrientation);
    this.tilt.enabled = false;
    this.tilt.x = 0;
    this.tilt.y = 0;
  }

  private onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.beta === null || e.gamma === null) return;
    // Calibrate to however the child is holding the phone when tilt was switched on.
    if (!this.tiltBase) this.tiltBase = { beta: e.beta, gamma: e.gamma };
    const db = e.beta - this.tiltBase.beta;
    const dg = e.gamma - this.tiltBase.gamma;
    const angle = (screen as unknown as { orientation?: { angle?: number } }).orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0;
    const landscape = window.innerWidth > window.innerHeight;
    let x: number;
    let y: number;
    if (landscape) {
      const sign = angle === 90 || angle === -270 ? 1 : -1;
      x = (db / 22) * sign;
      y = (dg / 22) * sign;
    } else {
      x = dg / 22;
      y = db / 22;
    }
    const dead = (v: number) => (Math.abs(v) < 0.12 ? 0 : Math.max(-1, Math.min(1, v)));
    this.tilt.x = dead(x);
    this.tilt.y = dead(y);
  };
}

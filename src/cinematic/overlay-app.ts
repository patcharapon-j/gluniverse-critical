import { MODULE_ID, OVERLAY_CONTAINER_ID, OVERLAY_Z_INDEX } from '../constants';

declare const PIXI: {
  Application: new (options: object) => PixiApp;
  Container: new () => PixiContainer;
};

interface PixiApp {
  view: HTMLCanvasElement;
  stage: PixiContainer;
  renderer: { resize(w: number, h: number): void };
  ticker: {
    start(): void;
    stop(): void;
    add(fn: (dt: number) => void): void;
    remove(fn: (dt: number) => void): void;
  };
  destroy(removeView?: boolean, options?: object): void;
  start(): void;
  stop(): void;
}

interface PixiContainer {
  addChild(child: unknown): unknown;
  removeChild(child: unknown): unknown;
  removeChildren(): unknown[];
  children: unknown[];
}

let app: PixiApp | null = null;
let container: HTMLDivElement | null = null;
let resizeHandler: (() => void) | null = null;

export function mountOverlay(): void {
  if (app) return;
  if (typeof PIXI === 'undefined') {
    console.warn(`${MODULE_ID} | PIXI not available on globalThis; overlay not mounted.`);
    return;
  }

  container = document.createElement('div');
  container.id = OVERLAY_CONTAINER_ID;
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: String(OVERLAY_Z_INDEX),
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(container);

  app = new PIXI.Application({
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  });
  container.appendChild(app.view);
  app.stop();

  resizeHandler = () => {
    if (!app) return;
    app.renderer.resize(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', resizeHandler);
}

export function getOverlayApp(): PixiApp | null {
  return app;
}

export function unmountOverlay(): void {
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }
  if (app) {
    app.destroy(true);
    app = null;
  }
  if (container?.parentNode) {
    container.parentNode.removeChild(container);
    container = null;
  }
}

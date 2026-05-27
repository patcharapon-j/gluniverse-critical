import { playSfx } from '../audio/sfx-player';
import { EASE_IN_FRACTION, EASE_OUT_FRACTION, MODULE_ID } from '../constants';
import type { CritEvent } from '../types/module';
import { getOverlayApp } from './overlay-app';

declare const PIXI: {
  Container: new () => PixiContainer;
  Sprite: new (texture: unknown) => PixiSprite;
  Graphics: new () => PixiGraphics;
  Texture: { from(src: string): PixiTexture };
};
declare const loadTexture: (
  src: string,
  options?: { fallback?: string },
) => Promise<PixiTexture | null>;

interface PixiTexture {
  width?: number;
  height?: number;
  baseTexture?: { realWidth?: number; realHeight?: number; valid?: boolean };
  valid?: boolean;
}
interface PixiSprite {
  texture: PixiTexture;
  anchor: { set(x: number, y?: number): void };
  position: { set(x: number, y: number): void };
  scale: { set(x: number, y?: number): void };
  alpha: number;
  mask: unknown | null;
  width?: number;
  height?: number;
  destroy?: (options?: object) => void;
}
interface PixiGraphics {
  clear(): PixiGraphics;
  beginFill(color: number, alpha?: number): PixiGraphics;
  drawRect(x: number, y: number, w: number, h: number): PixiGraphics;
  endFill(): PixiGraphics;
  alpha: number;
  destroy?: (options?: object) => void;
}
interface PixiContainer {
  addChild(child: unknown): unknown;
  removeChildren(): unknown[];
  destroy?: (options?: object) => void;
}

const FALLBACK_IMAGE = 'icons/svg/mystery-man.svg';

const BG_FADE_IN_FRACTION = 0.2;
const BG_FADE_OUT_FRACTION = 0.28;
const BG_PEAK_ALPHA = 0.85;

export async function runCinematic(event: CritEvent): Promise<void> {
  const app = getOverlayApp();
  if (!app) {
    console.warn(`${MODULE_ID} | no overlay app; skipping cinematic`);
    return;
  }

  const texture = await loadImage(event.imagePath);
  if (!texture) {
    console.warn(`${MODULE_ID} | could not load image:`, event.imagePath);
    return;
  }

  const stage = new PIXI.Container();
  app.stage.addChild(stage);

  const { sw, sh } = screenSize();

  const backdrop = new PIXI.Graphics();
  backdrop.beginFill(0x000000, 1).drawRect(0, 0, sw, sh).endFill();
  backdrop.alpha = 0;
  stage.addChild(backdrop);

  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.position.set(sw * 0.5, sh * 0.5);
  const baseScale = aspectFitScale(texture, sw, sh);
  sprite.scale.set(baseScale);
  sprite.alpha = 0;
  stage.addChild(sprite);

  const tw = texture.baseTexture?.realWidth ?? texture.width ?? 0;
  const th = texture.baseTexture?.realHeight ?? texture.height ?? 0;
  const fitW = tw * baseScale;
  const fitH = th * baseScale;

  const mask = new PIXI.Graphics();
  stage.addChild(mask);
  sprite.mask = mask;

  const drawMask = (frac: number): void => {
    const clamped = Math.max(0, Math.min(1, frac));
    const h = fitH * clamped;
    const x = sw * 0.5 - fitW * 0.5;
    const y = sh * 0.5 - h * 0.5;
    mask.clear().beginFill(0xffffff, 1).drawRect(x, y, fitW, h).endFill();
  };
  drawMask(0);

  playSfx(event.isPC ? 'pc' : 'gm');
  app.start();

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (): void => {
      const t = Math.min(1, (performance.now() - start) / event.durationMs);
      const frame = animate(t);
      backdrop.alpha = frame.bgAlpha;
      sprite.alpha = frame.imgAlpha;
      sprite.scale.set(baseScale * frame.scaleMul);
      drawMask(frame.wipe);

      if (t >= 1) {
        app.ticker.remove(tick);
        resolve();
      }
    };
    app.ticker.add(tick);
  });

  sprite.mask = null;
  stage.removeChildren();
  (app.stage as PixiContainer).removeChildren();
  sprite.destroy?.({ children: true });
  backdrop.destroy?.({ children: true });
  mask.destroy?.({ children: true });
  stage.destroy?.({ children: true });
  app.stop();
}

interface Frame {
  bgAlpha: number;
  imgAlpha: number;
  scaleMul: number;
  wipe: number;
}

const HOLD_DRIFT = 0.04;
const OUT_SCALE_BOOST = 0.16;

function animate(t: number): Frame {
  let bgAlpha: number;
  if (t < BG_FADE_IN_FRACTION) {
    bgAlpha = easeOutCubic(t / BG_FADE_IN_FRACTION) * BG_PEAK_ALPHA;
  } else if (t > 1 - BG_FADE_OUT_FRACTION) {
    const k = (t - (1 - BG_FADE_OUT_FRACTION)) / BG_FADE_OUT_FRACTION;
    bgAlpha = BG_PEAK_ALPHA * (1 - easeInCubic(k));
  } else {
    bgAlpha = BG_PEAK_ALPHA;
  }

  let imgAlpha = 1;
  let scaleMul = 1;
  let wipe = 1;
  if (t < EASE_IN_FRACTION) {
    const k = t / EASE_IN_FRACTION;
    imgAlpha = easeOutCubic(k);
    scaleMul = 0.92 + 0.08 * easeOutQuint(k);
    wipe = easeOutQuart(k);
  } else if (t > 1 - EASE_OUT_FRACTION) {
    const k = (t - (1 - EASE_OUT_FRACTION)) / EASE_OUT_FRACTION;
    imgAlpha = 1 - easeInCubic(k);
    scaleMul = 1 + HOLD_DRIFT + OUT_SCALE_BOOST * easeOutCubic(k);
  } else {
    const holdLen = 1 - EASE_IN_FRACTION - EASE_OUT_FRACTION;
    const k = (t - EASE_IN_FRACTION) / holdLen;
    scaleMul = 1 + HOLD_DRIFT * easeInOutSine(k);
  }

  return { bgAlpha, imgAlpha, scaleMul, wipe };
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}
function easeInCubic(t: number): number {
  return t ** 3;
}
function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4;
}
function easeOutQuint(t: number): number {
  return 1 - (1 - t) ** 5;
}
function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

function screenSize(): { sw: number; sh: number } {
  return { sw: window.innerWidth, sh: window.innerHeight };
}

function aspectFitScale(texture: PixiTexture, sw: number, sh: number): number {
  const tw = texture.baseTexture?.realWidth ?? texture.width ?? 0;
  const th = texture.baseTexture?.realHeight ?? texture.height ?? 0;
  if (!tw || !th) return 1;
  return Math.min(sw / tw, sh / th);
}

async function loadImage(src: string): Promise<PixiTexture | null> {
  try {
    // v13+ namespaces this as foundry.canvas.loadTexture; the bare global is
    // deprecated. Fall back to the global, then to PIXI directly.
    const namespaced = (
      globalThis as {
        foundry?: { canvas?: { loadTexture?: typeof loadTexture } };
      }
    ).foundry?.canvas?.loadTexture;
    const fromGlobal =
      namespaced ?? (globalThis as { loadTexture?: typeof loadTexture }).loadTexture;
    if (typeof fromGlobal === 'function') {
      const t = await fromGlobal(src, { fallback: FALLBACK_IMAGE });
      if (t) return t;
    }
    if (typeof PIXI?.Texture?.from === 'function') {
      return PIXI.Texture.from(src);
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | image load failed:`, src, err);
  }
  return null;
}

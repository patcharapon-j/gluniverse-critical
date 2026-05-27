import { playSfx } from '../audio/sfx-player';
import {
  ANIMATION_MODES,
  BREAK_FADE_IN_FRACTION,
  BREAK_HOLD_FRACTION,
  EASE_IN_FRACTION,
  EASE_OUT_FRACTION,
  MODULE_ID,
} from '../constants';
import type { CritEvent } from '../types/module';
import { type DrawFrame, getRenderer } from './webgl/renderer';

const FALLBACK_IMAGE = 'icons/svg/mystery-man.svg';

const BG_FADE_IN_FRACTION = 0.2;
const BG_FADE_OUT_FRACTION = 0.28;
const BG_PEAK_ALPHA = 0.85;

export async function runCinematic(event: CritEvent): Promise<void> {
  const renderer = getRenderer();
  if (!renderer) {
    console.warn(`${MODULE_ID} | no WebGL renderer; skipping cinematic`);
    return;
  }

  const image = await loadImage(event.imagePath);
  if (!image) {
    console.warn(`${MODULE_ID} | could not load image:`, event.imagePath);
    return;
  }

  renderer.resize();
  renderer.setImage(image, image.naturalWidth, image.naturalHeight);

  const isBreak = event.mode === ANIMATION_MODES.BREAK;
  const frameFor = isBreak ? breakFrame : standardFrame;

  playSfx(event.isPC ? 'pc' : 'gm');

  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = (): void => {
      const t = Math.min(1, (performance.now() - start) / event.durationMs);
      renderer.draw(frameFor(t));
      if (t >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  renderer.clear();
}

function backdropAlpha(t: number): number {
  if (t < BG_FADE_IN_FRACTION) {
    return easeOutCubic(t / BG_FADE_IN_FRACTION) * BG_PEAK_ALPHA;
  }
  if (t > 1 - BG_FADE_OUT_FRACTION) {
    const k = (t - (1 - BG_FADE_OUT_FRACTION)) / BG_FADE_OUT_FRACTION;
    return BG_PEAK_ALPHA * (1 - easeInCubic(k));
  }
  return BG_PEAK_ALPHA;
}

const HOLD_DRIFT = 0.04;
const OUT_SCALE_BOOST = 0.16;

function standardFrame(t: number): DrawFrame {
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

  return { bgAlpha: backdropAlpha(t), imgAlpha, shatter: 0, scaleMul, wipe, flash: 0 };
}

const SHATTER_START = BREAK_FADE_IN_FRACTION + BREAK_HOLD_FRACTION;

function breakFrame(t: number): DrawFrame {
  let imgAlpha = 1;
  let scaleMul = 1;
  let shatter = 0;
  let flash = 0;

  if (t < BREAK_FADE_IN_FRACTION) {
    const k = t / BREAK_FADE_IN_FRACTION;
    imgAlpha = easeOutCubic(k);
    // Slam in: settle from an over-scaled punch down to rest.
    scaleMul = 1.12 - 0.12 * easeOutCubic(k);
  } else if (t >= SHATTER_START) {
    const k = (t - SHATTER_START) / (1 - SHATTER_START);
    shatter = k * k; // accelerate as the glass lets go
    // Bright glassy pop at the moment of breaking, decaying quickly.
    flash = 0.7 * Math.max(0, 1 - k * 6);
    // Hold full opacity; per-shard fade in the shader handles the dissolve.
    imgAlpha = 1 - easeInCubic(Math.max(0, (k - 0.7) / 0.3));
  }

  return {
    bgAlpha: backdropAlpha(t),
    imgAlpha,
    shatter,
    scaleMul,
    wipe: 1,
    flash,
  };
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

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  const tryLoad = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`failed to load ${url}`));
      img.src = url;
    });

  try {
    return await tryLoad(src);
  } catch (err) {
    console.warn(`${MODULE_ID} | image load failed, using fallback:`, src, err);
    try {
      return await tryLoad(FALLBACK_IMAGE);
    } catch {
      return null;
    }
  }
}

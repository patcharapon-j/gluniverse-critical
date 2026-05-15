import { MODULE_ID, SETTINGS } from '../constants';
import { getSetting } from '../settings/settings';

declare const game: {
  settings: { get(scope: string, key: string): unknown };
};

const audioCache = new Map<string, HTMLAudioElement>();

export function playSfx(kind: 'pc' | 'gm'): void {
  if (!getSetting<boolean>(SETTINGS.AUDIO_ENABLED)) return;

  const path = getSetting<string>(
    kind === 'pc' ? SETTINGS.PC_CRITICAL_SFX : SETTINGS.GM_CRITICAL_SFX,
  );
  if (!path) return;

  let el = audioCache.get(path);
  if (!el) {
    el = new Audio(path);
    el.preload = 'auto';
    audioCache.set(path, el);
  }

  const volume = clamp01(getSetting<number>(SETTINGS.VOLUME));
  const globalVolume = readGlobalInterfaceVolume();
  el.volume = clamp01(volume * globalVolume);
  el.currentTime = 0;
  el.play().catch((err) => {
    console.warn(`${MODULE_ID} | sfx play failed:`, err);
  });
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function readGlobalInterfaceVolume(): number {
  try {
    const v = game.settings.get('core', 'globalInterfaceVolume');
    if (typeof v === 'number') return clamp01(v);
  } catch {}
  return 1;
}

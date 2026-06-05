import { mountOverlay } from './cinematic/overlay-app';
import { MODULE_ID, SUPPORTED_SYSTEM_IDS } from './constants';
import { registerDetector } from './detector/register';
import { runMigrations } from './migrations';
import { createPublicAPI } from './public-api';
import { registerSettings } from './settings/settings';
import { registerSockets } from './sockets/broadcast';
import { registerActorSheetHooks } from './ui/actor-sheet-button';

declare const Hooks: {
  once(name: string, fn: (...args: any[]) => unknown): void;
  on(name: string, fn: (...args: any[]) => unknown): void;
};
declare const game: {
  system: { id: string };
  modules: Map<string, { api?: unknown; active: boolean; version: string }>;
  user: { isGM: boolean; id: string };
  actors: { get(id: string): unknown };
  settings: unknown;
  socket: unknown;
  i18n: { localize(key: string): string; format(key: string, data: object): string };
};

function isSupportedSystem(): boolean {
  return SUPPORTED_SYSTEM_IDS.includes(game.system.id);
}

Hooks.once('init', () => {
  if (!isSupportedSystem()) {
    console.warn(
      `${MODULE_ID} | Unsupported system detected (${game.system.id}). ` +
        `Supported systems: ${SUPPORTED_SYSTEM_IDS.join(', ')}. Module disabled.`,
    );
    return;
  }

  console.log(`${MODULE_ID} | init (system: ${game.system.id})`);
  registerSettings();

  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    (mod as { api?: unknown }).api = createPublicAPI(mod.version);
  }
});

Hooks.once('ready', async () => {
  if (!isSupportedSystem()) return;

  console.log(`${MODULE_ID} | ready`);
  await runMigrations();
  mountOverlay();
  registerSockets();
  registerDetector();
  registerActorSheetHooks();
});

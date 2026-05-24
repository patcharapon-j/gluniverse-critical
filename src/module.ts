import { mountOverlay } from './cinematic/overlay-app';
import { MODULE_ID, PF2E_SYSTEM_ID } from './constants';
import { registerDetector } from './detector/pf2e-detector';
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

Hooks.once('init', () => {
  if (game.system.id !== PF2E_SYSTEM_ID) {
    console.warn(`${MODULE_ID} | Non-PF2e system detected (${game.system.id}). Module disabled.`);
    return;
  }

  console.log(`${MODULE_ID} | init`);
  registerSettings();

  const mod = game.modules.get(MODULE_ID);
  if (mod) {
    (mod as { api?: unknown }).api = createPublicAPI(mod.version);
  }
});

Hooks.once('ready', async () => {
  if (game.system.id !== PF2E_SYSTEM_ID) return;

  console.log(`${MODULE_ID} | ready`);
  await runMigrations();
  mountOverlay();
  registerSockets();
  registerDetector();
  registerActorSheetHooks();
});

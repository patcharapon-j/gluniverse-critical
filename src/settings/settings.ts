import {
  DURATION_DEFAULT_MS,
  DURATION_MAX_MS,
  DURATION_MIN_MS,
  MODULE_ID,
  SETTINGS,
  TRIGGER_MODES,
} from '../constants';
import { GMConfigMenu } from './gm-config-menu';

declare const game: {
  settings: {
    register(scope: string, key: string, data: object): void;
    registerMenu(scope: string, key: string, data: object): void;
    get(scope: string, key: string): unknown;
    set(scope: string, key: string, value: unknown): Promise<unknown>;
  };
  i18n: { localize(key: string): string };
};

export function registerSettings(): void {
  game.settings.registerMenu(MODULE_ID, 'gmConfigMenu', {
    name: 'GLUC.Settings.MenuName',
    label: 'GLUC.Settings.MenuLabel',
    hint: 'GLUC.Settings.MenuHint',
    icon: 'fas fa-cog',
    type: GMConfigMenu,
    restricted: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.GM_AVATAR, {
    name: 'GLUC.Settings.GMAvatar',
    hint: 'GLUC.Settings.GMAvatarHint',
    scope: 'world',
    config: false,
    type: String,
    default: '',
  });

  game.settings.register(MODULE_ID, SETTINGS.PC_CRITICAL_SFX, {
    name: 'GLUC.Settings.PCCriticalSFX',
    hint: 'GLUC.Settings.PCCriticalSFXHint',
    scope: 'world',
    config: false,
    type: String,
    default: '',
  });

  game.settings.register(MODULE_ID, SETTINGS.GM_CRITICAL_SFX, {
    name: 'GLUC.Settings.GMCriticalSFX',
    hint: 'GLUC.Settings.GMCriticalSFXHint',
    scope: 'world',
    config: false,
    type: String,
    default: '',
  });

  game.settings.register(MODULE_ID, SETTINGS.CINEMATIC_DURATION, {
    name: 'GLUC.Settings.CinematicDuration',
    hint: 'GLUC.Settings.CinematicDurationHint',
    scope: 'world',
    config: false,
    type: Number,
    default: DURATION_DEFAULT_MS,
    range: { min: DURATION_MIN_MS, max: DURATION_MAX_MS, step: 50 },
  });

  game.settings.register(MODULE_ID, SETTINGS.TRIGGER_MODE, {
    name: 'GLUC.Settings.TriggerMode',
    hint: 'GLUC.Settings.TriggerModeHint',
    scope: 'world',
    config: true,
    type: String,
    choices: {
      [TRIGGER_MODES.PF2E_DEGREE_OF_SUCCESS]: 'GLUC.Settings.TriggerModeChoicePF2e',
      [TRIGGER_MODES.NAT20_ONLY]: 'GLUC.Settings.TriggerModeChoiceNat20',
    },
    default: TRIGGER_MODES.PF2E_DEGREE_OF_SUCCESS,
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_SKILL_CRITS, {
    name: 'GLUC.Settings.EnableSkillCrits',
    hint: 'GLUC.Settings.EnableSkillCritsHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.ENABLE_PERCEPTION_CRITS, {
    name: 'GLUC.Settings.EnablePerceptionCrits',
    hint: 'GLUC.Settings.EnablePerceptionCritsHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, SETTINGS.ALLOW_PLAYER_OPT_OUT, {
    name: 'GLUC.Settings.AllowPlayerOptOut',
    hint: 'GLUC.Settings.AllowPlayerOptOutHint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.SHOW_CINEMATICS, {
    name: 'GLUC.Settings.ShowCinematics',
    hint: 'GLUC.Settings.ShowCinematicsHint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.AUDIO_ENABLED, {
    name: 'GLUC.Settings.AudioEnabled',
    hint: 'GLUC.Settings.AudioEnabledHint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, SETTINGS.VOLUME, {
    name: 'GLUC.Settings.Volume',
    hint: 'GLUC.Settings.VolumeHint',
    scope: 'client',
    config: true,
    type: Number,
    default: 0.8,
    range: { min: 0, max: 1, step: 0.05 },
  });
}

export function getSetting<T>(key: string): T {
  return game.settings.get(MODULE_ID, key) as T;
}

export function setSetting<T>(key: string, value: T): Promise<unknown> {
  return game.settings.set(MODULE_ID, key, value);
}

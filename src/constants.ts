export const MODULE_ID = 'gluniverse-critical' as const;
export const SOCKET_CHANNEL = `module.${MODULE_ID}` as const;
export const FLAG_SCOPE = MODULE_ID;

export const SCHEMA_VERSION = 2 as const;

export const DURATION_MIN_MS = 600;
export const DURATION_MAX_MS = 3000;
export const DURATION_DEFAULT_MS = 1000;

export const EASE_IN_FRACTION = 0.15;
export const EASE_OUT_FRACTION = 0.20;

// "break" mode timeline (fractions of the total duration): the image fades in,
// holds intact briefly, then shatters toward the viewer for the remainder.
export const BREAK_FADE_IN_FRACTION = 0.22;
export const BREAK_HOLD_FRACTION = 0.12;

export const QUEUE_MAX = 3;
export const DEDUPE_WINDOW_MS = 500;
export const BROADCAST_SYNC_TOLERANCE_MS = 150;

export const OVERLAY_Z_INDEX = 99999;
export const OVERLAY_CONTAINER_ID = `${MODULE_ID}-overlay`;

export const SETTINGS = {
  GM_AVATAR: 'gmAvatar',
  PC_CRITICAL_SFX: 'pcCriticalSfx',
  GM_CRITICAL_SFX: 'gmCriticalSfx',
  CINEMATIC_DURATION: 'cinematicDuration',
  ANIMATION_MODE: 'animationMode',
  TRIGGER_MODE: 'triggerMode',
  ENABLE_SKILL_CRITS: 'enableSkillCrits',
  ENABLE_PERCEPTION_CRITS: 'enablePerceptionCrits',
  ALLOW_PLAYER_OPT_OUT: 'allowPlayerOptOut',
  SHOW_CINEMATICS: 'showCinematics',
  AUDIO_ENABLED: 'audioEnabled',
  VOLUME: 'volume',
} as const;

export const TRIGGER_MODES = {
  PF2E_DEGREE_OF_SUCCESS: 'pf2e',
  NAT20_ONLY: 'nat20',
} as const;

export type TriggerMode = (typeof TRIGGER_MODES)[keyof typeof TRIGGER_MODES];

export const ANIMATION_MODES = {
  STANDARD: 'standard',
  BREAK: 'break',
} as const;

export type AnimationMode = (typeof ANIMATION_MODES)[keyof typeof ANIMATION_MODES];

export const ACTOR_FLAGS = {
  SCHEMA_VERSION: 'schemaVersion',
  ENABLED: 'enabled',
  PORTRAIT_OVERRIDE: 'portraitOverride',
} as const;

export const LEGACY_ACTOR_FLAG_KEYS = [
  'templateSlug',
  'colorPrimary',
  'colorAccent',
  'colorBg',
] as const;

export const PF2E_SYSTEM_ID = 'pf2e' as const;

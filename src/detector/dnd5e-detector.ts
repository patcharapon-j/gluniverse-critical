import { ACTOR_FLAGS, DND5E_SYSTEM_ID, FLAG_SCOPE, SETTINGS, type TriggerMode } from '../constants';
import { getSetting } from '../settings/settings';
import { getAttackCriticalHit, hasNat20Result } from './dice';
import { detectDnd5e } from './dnd5e-detect';
import type { AnyActor, AnyChatMessage, DetectorInput, SystemAdapter } from './types';

declare const game: {
  system: { id: string };
  actors: { get(id: string): unknown };
};

export function buildInputFromMessage(message: AnyChatMessage): DetectorInput {
  const actorId = message.speaker?.actor;
  const actor = actorId ? (game.actors.get(actorId) as AnyActor | undefined) : undefined;
  const rollFlag = message.flags?.dnd5e?.roll ?? null;
  return {
    systemId: game.system.id,
    context: null,
    dnd5eRoll: rollFlag
      ? { type: rollFlag.type, skillId: rollFlag.skillId, ability: rollFlag.ability }
      : null,
    criticalHit: getAttackCriticalHit(message),
    rollMode: message.rollMode ?? 'publicroll',
    whisperLength: message.whisper?.length ?? 0,
    blind: message.blind ?? false,
    hasActor: !!actor,
    actorHasPlayerOwner: actor?.hasPlayerOwner ?? false,
    npcEnabled: actor
      ? ((actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.ENABLED) as boolean) ?? false)
      : false,
    triggerMode: getSetting<TriggerMode>(SETTINGS.TRIGGER_MODE),
    nat20Detected: hasNat20Result(message),
    skillCritsEnabled: getSetting<boolean>(SETTINGS.ENABLE_SKILL_CRITS),
    perceptionCritsEnabled: getSetting<boolean>(SETTINGS.ENABLE_PERCEPTION_CRITS),
  };
}

export const dnd5eAdapter: SystemAdapter = {
  systemId: DND5E_SYSTEM_ID,
  buildInput: buildInputFromMessage,
  detect: detectDnd5e,
};

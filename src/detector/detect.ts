import type { DetectorInput, DetectorResult } from './types';

const SUPPORTED_ROLL_TYPES = new Set([
  'attack-roll',
  'spell-attack-roll',
  'saving-throw',
  'skill-check',
  'perception-check',
]);
const HARD_BLOCK = new Set(['flat-check', 'damage-roll', 'initiative']);
const PF2E_SYSTEM_ID = 'pf2e';

export function detect(input: DetectorInput): DetectorResult {
  if (input.systemId !== PF2E_SYSTEM_ID) return { fire: false, reason: 'wrong-system' };

  if (input.rollMode === 'blindroll' || input.blind) {
    return { fire: false, reason: 'secret-or-blind-roll' };
  }

  if (!input.hasActor) return { fire: false, reason: 'no-actor' };

  if (input.triggerMode === 'nat20') {
    if (!input.nat20Detected) return { fire: false, reason: 'not-nat20' };
    if (!input.actorHasPlayerOwner && !input.npcEnabled) {
      return { fire: false, reason: 'npc-not-enabled' };
    }
    return { fire: true, reason: 'nat20' };
  }

  if (!input.context) return { fire: false, reason: 'no-context' };

  const type = input.context.type;
  if (!type) return { fire: false, reason: 'no-context' };

  if (HARD_BLOCK.has(type)) {
    return {
      fire: false,
      reason: type === 'flat-check' ? 'flat-check-blocked' : 'damage-or-initiative-blocked',
    };
  }

  if (!SUPPORTED_ROLL_TYPES.has(type)) {
    return { fire: false, reason: 'unsupported-roll-type' };
  }

  if (input.context.outcome !== 'criticalSuccess') {
    return { fire: false, reason: 'not-critical-success' };
  }

  if (type === 'skill-check' && !input.skillCritsEnabled) {
    return { fire: false, reason: 'skill-crits-disabled' };
  }
  if (type === 'perception-check' && !input.perceptionCritsEnabled) {
    return { fire: false, reason: 'perception-crits-disabled' };
  }

  if (!input.actorHasPlayerOwner && !input.npcEnabled) {
    return { fire: false, reason: 'npc-not-enabled' };
  }

  return { fire: true, reason: 'pf2e-critical-success' };
}

import { DND5E_PERCEPTION_SKILL_ID, DND5E_SYSTEM_ID } from '../constants';
import type { DetectorInput, DetectorResult } from './types';

// dnd5e has no PF2e-style degree of success. A "critical" only exists for attack
// rolls (the d20 meeting the critical threshold). For ability checks, saving
// throws, skill/tool checks and death saves there is no rules crit, so a natural
// 20 is treated as the celebratory moment — gated by the same skill/perception
// toggles the PF2e mode uses.
const NEVER_FIRES = new Set(['damage', 'initiative']);

function isPerceptionSkill(skillId?: string): boolean {
  return skillId === DND5E_PERCEPTION_SKILL_ID || skillId === 'perception';
}

export function detectDnd5e(input: DetectorInput): DetectorResult {
  if (input.systemId !== DND5E_SYSTEM_ID) return { fire: false, reason: 'wrong-system' };

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

  const roll = input.dnd5eRoll;
  const type = roll?.type;
  if (!type) return { fire: false, reason: 'no-context' };

  if (NEVER_FIRES.has(type)) {
    return { fire: false, reason: 'damage-or-initiative-blocked' };
  }

  let fireReason: 'dnd5e-critical-hit' | 'nat20';

  if (type === 'attack') {
    // Prefer the mechanical critical-hit flag; fall back to a natural 20 when the
    // threshold could not be read (criticalHit === undefined).
    const isCrit = input.criticalHit ?? input.nat20Detected;
    if (!isCrit) return { fire: false, reason: 'not-critical-hit' };
    fireReason = 'dnd5e-critical-hit';
  } else if (type === 'skill' || type === 'tool') {
    if (type === 'skill' && isPerceptionSkill(roll?.skillId)) {
      if (!input.perceptionCritsEnabled) {
        return { fire: false, reason: 'perception-crits-disabled' };
      }
    } else if (!input.skillCritsEnabled) {
      return { fire: false, reason: 'skill-crits-disabled' };
    }
    if (!input.nat20Detected) return { fire: false, reason: 'not-critical-hit' };
    fireReason = 'nat20';
  } else if (type === 'ability') {
    if (!input.skillCritsEnabled) return { fire: false, reason: 'skill-crits-disabled' };
    if (!input.nat20Detected) return { fire: false, reason: 'not-critical-hit' };
    fireReason = 'nat20';
  } else if (type === 'save' || type === 'death') {
    if (!input.nat20Detected) return { fire: false, reason: 'not-critical-hit' };
    fireReason = 'nat20';
  } else {
    return { fire: false, reason: 'unsupported-roll-type' };
  }

  if (!input.actorHasPlayerOwner && !input.npcEnabled) {
    return { fire: false, reason: 'npc-not-enabled' };
  }

  return { fire: true, reason: fireReason };
}

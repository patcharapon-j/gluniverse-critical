import type { TriggerMode } from '../constants';
import type { PF2eDegreeOfSuccess, PF2eRollContextType } from '../types/pf2e';

export type RollMode = 'publicroll' | 'gmroll' | 'blindroll' | 'selfroll' | string;

export interface DetectorInput {
  systemId: string;
  context: {
    type?: PF2eRollContextType;
    outcome?: PF2eDegreeOfSuccess;
  } | null;
  rollMode: RollMode;
  whisperLength: number;
  blind: boolean;
  hasActor: boolean;
  actorHasPlayerOwner: boolean;
  npcEnabled: boolean;
  triggerMode: TriggerMode;
  nat20Detected: boolean;
  skillCritsEnabled: boolean;
  perceptionCritsEnabled: boolean;
}

export type DetectorFireReason = 'pf2e-critical-success' | 'nat20';

export type DetectorResult =
  | { fire: true; reason: DetectorFireReason }
  | { fire: false; reason: DetectorRejectReason };

export type DetectorRejectReason =
  | 'wrong-system'
  | 'no-context'
  | 'not-critical-success'
  | 'not-nat20'
  | 'unsupported-roll-type'
  | 'flat-check-blocked'
  | 'damage-or-initiative-blocked'
  | 'skill-crits-disabled'
  | 'perception-crits-disabled'
  | 'no-actor'
  | 'npc-not-enabled'
  | 'secret-or-blind-roll';

import type { TriggerMode } from '../constants';
import type { Dnd5eRollType } from '../types/dnd5e';
import type { PF2eDegreeOfSuccess, PF2eRollContextType } from '../types/pf2e';
import type { RollLike } from './dice';

export type RollMode = 'publicroll' | 'gmroll' | 'blindroll' | 'selfroll' | string;

export interface DetectorInput {
  systemId: string;
  /** PF2e degree-of-success context. Null for non-PF2e systems. */
  context: {
    type?: PF2eRollContextType;
    outcome?: PF2eDegreeOfSuccess;
  } | null;
  /** dnd5e roll metadata (`flags.dnd5e.roll`). Null for non-dnd5e systems. */
  dnd5eRoll?: {
    type?: Dnd5eRollType;
    skillId?: string;
    ability?: string;
  } | null;
  /**
   * Whether an attack roll is a critical hit (dnd5e). `undefined` when the roll
   * is not an attack or the d20 could not be read.
   */
  criticalHit?: boolean;
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

export type DetectorFireReason = 'pf2e-critical-success' | 'dnd5e-critical-hit' | 'nat20';

export type DetectorResult =
  | { fire: true; reason: DetectorFireReason }
  | { fire: false; reason: DetectorRejectReason };

export type DetectorRejectReason =
  | 'wrong-system'
  | 'no-context'
  | 'not-critical-success'
  | 'not-critical-hit'
  | 'not-nat20'
  | 'unsupported-roll-type'
  | 'flat-check-blocked'
  | 'damage-or-initiative-blocked'
  | 'skill-crits-disabled'
  | 'perception-crits-disabled'
  | 'no-actor'
  | 'npc-not-enabled'
  | 'secret-or-blind-roll';

/** A permissive view of a Foundry chat message, shared by the system adapters. */
export type AnyChatMessage = {
  id?: string;
  author?: { id?: string };
  user?: string | { id?: string };
  speaker?: { actor?: string };
  whisper?: string[];
  blind?: boolean;
  rollMode?: string;
  rolls?: RollLike[];
  flags?: {
    pf2e?: { context?: { type?: string; outcome?: string } };
    dnd5e?: { messageType?: string; roll?: { type?: string; ability?: string; skillId?: string } };
  };
};

export type AnyActor = {
  id: string;
  name?: string;
  hasPlayerOwner?: boolean;
  getFlag(scope: string, key: string): unknown;
};

/**
 * Per-system bridge between a raw chat message and the pure detector. The
 * generic detector registration (`register.ts`) picks one based on the active
 * game system.
 */
export interface SystemAdapter {
  systemId: string;
  buildInput(message: AnyChatMessage): DetectorInput;
  detect(input: DetectorInput): DetectorResult;
}

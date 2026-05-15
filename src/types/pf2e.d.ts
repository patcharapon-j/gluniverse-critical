export type PF2eRollContextType =
  | 'attack-roll'
  | 'spell-attack-roll'
  | 'saving-throw'
  | 'skill-check'
  | 'perception-check'
  | 'flat-check'
  | 'damage-roll'
  | 'initiative'
  | string;

export type PF2eDegreeOfSuccess = 'criticalSuccess' | 'success' | 'failure' | 'criticalFailure';

export interface PF2eRollContext {
  type?: PF2eRollContextType;
  outcome?: PF2eDegreeOfSuccess;
  isReroll?: boolean;
  domains?: string[];
  options?: string[];
  actor?: string;
  token?: string;
  origin?: { actor?: string };
}

export interface PF2eChatMessageFlags {
  context?: PF2eRollContext;
  modifierName?: string;
}

declare global {
  interface ChatMessageFlags {
    pf2e?: PF2eChatMessageFlags;
  }
}

// Minimal typings for the slice of the dnd5e (D&D 5e) system chat-message flags
// this module reads. Verified against dnd5e 5.x. We only model the `flags.dnd5e`
// shape needed by the detector — not the full system API.

export type Dnd5eRollType =
  | 'attack'
  | 'damage'
  | 'save'
  | 'ability'
  | 'skill'
  | 'tool'
  | 'death'
  | 'initiative'
  | string;

export interface Dnd5eRollFlag {
  /** Roll category. Set by Actor5e roll methods / activities. */
  type?: Dnd5eRollType;
  /** Ability key for ability checks and saving throws (e.g. 'str', 'dex'). */
  ability?: string;
  /** Skill key for skill checks (e.g. 'prc' for Perception). */
  skillId?: string;
  /** Tool key for tool checks. */
  tool?: string;
}

export interface Dnd5eChatMessageFlags {
  /** 'roll' for roll messages, 'usage' for activity usage cards. */
  messageType?: string;
  roll?: Dnd5eRollFlag;
}

declare global {
  interface ChatMessageFlags {
    dnd5e?: Dnd5eChatMessageFlags;
  }
}

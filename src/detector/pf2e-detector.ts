import { enqueue } from '../cinematic/queue';
import { resolveCritEvent } from '../cinematic/resolver';
import { ACTOR_FLAGS, FLAG_SCOPE, MODULE_ID, SETTINGS, type TriggerMode } from '../constants';
import { getSetting } from '../settings/settings';
import { broadcastCrit } from '../sockets/broadcast';
import { detect } from './detect';
import type { DetectorInput } from './types';

export { detect } from './detect';

declare const Hooks: {
  on(name: string, fn: (...args: unknown[]) => unknown): void;
};
declare const game: {
  system: { id: string };
  user: { id: string; isGM: boolean };
  actors: { get(id: string): unknown };
  messages?: { get(id: string): unknown };
  settings: { get(scope: string, key: string): unknown };
};

type DieResult = { result?: number; active?: boolean; discarded?: boolean };
type DieTerm = { faces?: number; results?: DieResult[] };
type RollLike = { dice?: DieTerm[] };

type AnyChatMessage = {
  id?: string;
  author?: { id?: string };
  user?: string | { id?: string };
  speaker?: { actor?: string };
  whisper?: string[];
  blind?: boolean;
  rollMode?: string;
  rolls?: RollLike[];
  flags?: {
    pf2e?: {
      context?: { type?: string; outcome?: string };
    };
  };
};

type AnyActor = {
  id: string;
  name?: string;
  hasPlayerOwner?: boolean;
  getFlag(scope: string, key: string): unknown;
};

export function buildInputFromMessage(message: AnyChatMessage): DetectorInput {
  const actorId = message.speaker?.actor;
  const actor = actorId ? (game.actors.get(actorId) as AnyActor | undefined) : undefined;
  return {
    systemId: game.system.id,
    context: (message.flags?.pf2e?.context ?? null) as DetectorInput['context'],
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

function hasNat20Result(message: AnyChatMessage): boolean {
  const rolls = message.rolls;
  if (!Array.isArray(rolls)) return false;
  for (const roll of rolls) {
    const dice = roll.dice;
    if (!Array.isArray(dice)) continue;
    for (const die of dice) {
      if (die.faces !== 20) continue;
      const results = die.results ?? [];
      for (const r of results) {
        if (r.discarded === true) continue;
        if (r.active === false) continue;
        if (r.result === 20) return true;
      }
    }
  }
  return false;
}

let lastDiceSoNiceMessageId: string | null = null;
let lastDiceSoNiceTimestamp = 0;

export function registerDetector(): void {
  const dsnActive = !!(game as unknown as { dice3d?: unknown }).dice3d;

  if (dsnActive) {
    Hooks.on('diceSoNiceRollComplete', (messageId: string) => {
      lastDiceSoNiceMessageId = messageId;
      lastDiceSoNiceTimestamp = performance.now();
      const message = getChatMessageById(messageId);
      if (message) processMessage(message);
    });
  }

  Hooks.on('createChatMessage', (message: AnyChatMessage) => {
    if (
      dsnActive &&
      message.id &&
      lastDiceSoNiceMessageId === message.id &&
      performance.now() - lastDiceSoNiceTimestamp < 5000
    ) {
      return;
    }
    if (!dsnActive) processMessage(message);
  });
}

export function getChatMessageById(messageId: string): AnyChatMessage | undefined {
  const fromCollection = game.messages?.get(messageId) as AnyChatMessage | undefined;
  if (fromCollection) return fromCollection;

  const ChatMessage = (
    globalThis as unknown as {
      ChatMessage?: { get(id: string): AnyChatMessage | undefined };
    }
  ).ChatMessage;
  return ChatMessage?.get(messageId);
}

function messageAuthorId(message: AnyChatMessage): string | undefined {
  return message.author?.id ?? (typeof message.user === 'string' ? message.user : message.user?.id);
}

function processMessage(message: AnyChatMessage): void {
  if (messageAuthorId(message) !== game.user.id) return;

  const input = buildInputFromMessage(message);
  const result = detect(input);
  if (!result.fire) {
    if (input.context?.outcome === 'criticalSuccess' || input.nat20Detected) {
      console.debug(`${MODULE_ID} | crit suppressed:`, result.reason);
    }
    return;
  }

  const event = resolveCritEvent({
    messageId: message.id ?? `${Date.now()}-${Math.random()}`,
    actorId: message.speaker?.actor ?? '',
    isPC: input.actorHasPlayerOwner,
    originUserId: game.user.id,
  });
  if (!event) return;

  enqueue(event);
  if (input.whisperLength === 0 && input.rollMode === 'publicroll') {
    broadcastCrit(event);
  }
}

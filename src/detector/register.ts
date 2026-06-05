import { enqueue } from '../cinematic/queue';
import { resolveCritEvent } from '../cinematic/resolver';
import { MODULE_ID } from '../constants';
import { broadcastCrit } from '../sockets/broadcast';
import { dnd5eAdapter } from './dnd5e-detector';
import { pf2eAdapter } from './pf2e-detector';
import type { AnyChatMessage, DetectorInput, SystemAdapter } from './types';

type HookCallback = (...args: unknown[]) => unknown;

declare const Hooks: {
  on(name: string, fn: HookCallback): void;
};
declare const game: {
  system: { id: string };
  user: { id: string; isGM: boolean };
  messages?: { get(id: string): unknown };
};

const ADAPTERS: SystemAdapter[] = [pf2eAdapter, dnd5eAdapter];

export function getAdapter(systemId: string): SystemAdapter | undefined {
  return ADAPTERS.find((a) => a.systemId === systemId);
}

let lastDiceSoNiceMessageId: string | null = null;
let lastDiceSoNiceTimestamp = 0;

export function registerDetector(): void {
  const adapter = getAdapter(game.system.id);
  if (!adapter) return;

  const dsnActive = !!(game as unknown as { dice3d?: unknown }).dice3d;

  if (dsnActive) {
    Hooks.on('diceSoNiceRollComplete', (messageId) => {
      const id = messageId as string;
      lastDiceSoNiceMessageId = id;
      lastDiceSoNiceTimestamp = performance.now();
      const message = getChatMessageById(id);
      if (message) processMessage(adapter, message);
    });
  }

  Hooks.on('createChatMessage', (raw) => {
    const message = raw as AnyChatMessage;
    if (
      dsnActive &&
      message.id &&
      lastDiceSoNiceMessageId === message.id &&
      performance.now() - lastDiceSoNiceTimestamp < 5000
    ) {
      return;
    }
    if (!dsnActive) processMessage(adapter, message);
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

/** Whether a suppressed result is worth a debug log (i.e. it looked like a crit). */
function looksLikeCrit(input: DetectorInput): boolean {
  return (
    input.context?.outcome === 'criticalSuccess' ||
    input.criticalHit === true ||
    input.nat20Detected
  );
}

function processMessage(adapter: SystemAdapter, message: AnyChatMessage): void {
  if (messageAuthorId(message) !== game.user.id) return;

  const input = adapter.buildInput(message);
  const result = adapter.detect(input);
  if (!result.fire) {
    if (looksLikeCrit(input)) {
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

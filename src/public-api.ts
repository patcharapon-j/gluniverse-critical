import { resolveCritEvent } from './cinematic/resolver';
import { runCinematic } from './cinematic/runner';
import { MODULE_ID } from './constants';
import { broadcastCrit } from './sockets/broadcast';
import type { CritEvent } from './types/module';
import type { PublicAPI } from './types/module';

declare const game: {
  user: { id: string; isGM: boolean };
  actors: { get(id: string): { hasPlayerOwner?: boolean } | undefined };
};

function buildManualEvent(actorId: string): CritEvent | null {
  const actor = game.actors.get(actorId);
  const isPC = actor?.hasPlayerOwner ?? true;
  return resolveCritEvent({
    messageId: `manual-${Date.now()}`,
    actorId,
    isPC,
    originUserId: game.user.id,
  });
}

export function createPublicAPI(version: string): PublicAPI {
  return {
    version,
    async triggerLocal(actorId: string): Promise<void> {
      const event = buildManualEvent(actorId);
      if (!event) return;
      await runCinematic(event);
    },
    async triggerBroadcast(actorId: string): Promise<void> {
      if (!game.user.isGM) {
        console.warn(`${MODULE_ID} | triggerBroadcast is GM-only; ignoring call.`);
        return;
      }
      const event = buildManualEvent(actorId);
      if (!event) return;
      broadcastCrit(event);
      await runCinematic(event);
    },
  };
}

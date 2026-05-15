import { resolveCritEvent } from './cinematic/resolver';
import { runCinematic } from './cinematic/runner';
import type { PublicAPI } from './types/module';

declare const game: {
  user: { id: string };
  actors: { get(id: string): { hasPlayerOwner?: boolean } | undefined };
};

export function createPublicAPI(): PublicAPI {
  return {
    version: '1.0.0',
    async triggerLocal(actorId: string): Promise<void> {
      const actor = game.actors.get(actorId);
      const isPC = actor?.hasPlayerOwner ?? true;
      const event = resolveCritEvent({
        messageId: `manual-${Date.now()}`,
        actorId,
        isPC,
        originUserId: game.user.id,
      });
      if (!event) return;
      await runCinematic(event);
    },
  };
}

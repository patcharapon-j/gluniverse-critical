import { ACTOR_FLAGS, FLAG_SCOPE, SETTINGS } from '../constants';
import { getSetting } from '../settings/settings';
import type { CritEvent } from '../types/module';

declare const game: {
  actors: { get(id: string): unknown };
};

type AnyActor = {
  id: string;
  name?: string;
  img?: string;
  hasPlayerOwner?: boolean;
  getFlag(scope: string, key: string): unknown;
};

export interface ResolveInput {
  messageId: string;
  actorId: string;
  isPC: boolean;
  originUserId: string;
}

const FALLBACK_IMAGE = 'icons/svg/mystery-man.svg';

export function resolveCritEvent(input: ResolveInput): CritEvent | null {
  const actor = game.actors.get(input.actorId) as AnyActor | undefined;
  if (!actor) return null;

  return {
    messageId: input.messageId,
    actorId: input.actorId,
    actorName: actor.name ?? 'Unknown',
    isPC: input.isPC,
    imagePath: resolveImage(actor, input.isPC),
    durationMs: getSetting<number>(SETTINGS.CINEMATIC_DURATION),
    startTimestamp: Date.now(),
    originUserId: input.originUserId,
  };
}

function resolveImage(actor: AnyActor, isPC: boolean): string {
  const override = actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.PORTRAIT_OVERRIDE) as string | null;
  if (override) return override;
  if (isPC) return actor.img ?? FALLBACK_IMAGE;
  const gmAvatar = getSetting<string>(SETTINGS.GM_AVATAR);
  if (gmAvatar) return gmAvatar;
  return actor.img ?? FALLBACK_IMAGE;
}

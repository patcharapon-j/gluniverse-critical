import { ACTOR_FLAGS, FLAG_SCOPE, LEGACY_ACTOR_FLAG_KEYS, SCHEMA_VERSION } from '../constants';
import type { ActorFlagData } from '../types/module';

type AnyActor = {
  id: string;
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  unsetFlag(scope: string, key: string): Promise<unknown>;
};

export function readActorFlags(actor: AnyActor): ActorFlagData {
  return {
    schemaVersion: (actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.SCHEMA_VERSION) as number) ?? 0,
    enabled: (actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.ENABLED) as boolean | undefined) ?? false,
    portraitOverride:
      (actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.PORTRAIT_OVERRIDE) as string | null | undefined) ??
      null,
  };
}

export async function writeActorFlags(
  actor: AnyActor,
  patch: Partial<ActorFlagData>,
): Promise<void> {
  const writes: Array<Promise<unknown>> = [];
  if (patch.schemaVersion !== undefined) {
    writes.push(actor.setFlag(FLAG_SCOPE, ACTOR_FLAGS.SCHEMA_VERSION, patch.schemaVersion));
  }
  if (patch.enabled !== undefined) {
    writes.push(actor.setFlag(FLAG_SCOPE, ACTOR_FLAGS.ENABLED, patch.enabled));
  }
  if (patch.portraitOverride !== undefined) {
    writes.push(actor.setFlag(FLAG_SCOPE, ACTOR_FLAGS.PORTRAIT_OVERRIDE, patch.portraitOverride));
  }
  await Promise.all(writes);
}

export function migrateActorFlags(actor: AnyActor): Promise<void> | null {
  const current = (actor.getFlag(FLAG_SCOPE, ACTOR_FLAGS.SCHEMA_VERSION) as number) ?? 0;
  if (current === SCHEMA_VERSION) return null;

  return (async () => {
    if (current < 2) {
      for (const key of LEGACY_ACTOR_FLAG_KEYS) {
        const v = actor.getFlag(FLAG_SCOPE, key);
        if (v !== undefined) await actor.unsetFlag(FLAG_SCOPE, key);
      }
    }
    await actor.setFlag(FLAG_SCOPE, ACTOR_FLAGS.SCHEMA_VERSION, SCHEMA_VERSION);
  })();
}

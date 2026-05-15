import { MODULE_ID } from './constants';
import { migrateActorFlags } from './flags/actor-flags';

type AnyActor = Parameters<typeof migrateActorFlags>[0] & { name?: string };

declare const game: {
  actors: { contents?: AnyActor[]; values?: () => Iterable<AnyActor> };
};

export async function runMigrations(): Promise<void> {
  const actors: AnyActor[] =
    game.actors?.contents ?? (game.actors?.values ? [...game.actors.values()] : []);
  if (!actors.length) return;

  const pending: Array<Promise<void>> = [];
  for (const actor of actors) {
    const job = migrateActorFlags(actor);
    if (job) pending.push(job);
  }
  if (pending.length) {
    console.log(`${MODULE_ID} | Migrating ${pending.length} actor flag record(s)`);
    await Promise.all(pending);
  }
}

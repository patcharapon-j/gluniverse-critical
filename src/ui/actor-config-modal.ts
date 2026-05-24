import { resolveCritEvent } from '../cinematic/resolver';
import { runCinematic } from '../cinematic/runner';
import { MODULE_ID } from '../constants';
import { readActorFlags, writeActorFlags } from '../flags/actor-flags';
import { broadcastCrit } from '../sockets/broadcast';

type JQueryLike = { find(sel: string): { on(evt: string, fn: () => void): void } };

declare const FormApplication: {
  new (
    object: unknown,
    options?: object,
  ): {
    render(force?: boolean): unknown;
    activateListeners(html: JQueryLike): void;
    object: unknown;
    element: HTMLElement[] | { find(sel: string): HTMLElement[] };
  };
  defaultOptions: object;
};

declare const game: {
  user: { id: string; isGM: boolean };
  actors: { get(id: string): AnyActor | undefined };
  i18n: { localize(key: string): string; format(key: string, data: object): string };
};

type AnyActor = {
  id: string;
  name?: string;
  type?: string;
  hasPlayerOwner: boolean;
  getFlag(scope: string, key: string): unknown;
  setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
  unsetFlag(scope: string, key: string): Promise<unknown>;
};

export class ActorConfigModal extends FormApplication {
  static get defaultOptions(): object {
    return {
      ...FormApplication.defaultOptions,
      id: `${MODULE_ID}-actor-config`,
      template: `modules/${MODULE_ID}/templates/actor-config.html`,
      width: 480,
      height: 'auto',
      closeOnSubmit: true,
      submitOnChange: false,
    };
  }

  constructor(actor: AnyActor, options: object = {}) {
    super(actor, options);
  }

  get actor(): AnyActor {
    return this.object as AnyActor;
  }

  /**
   * Always operate on the world (base) actor, not a synthetic token-actor.
   * Synthetic actors write flags to the token's delta — those overrides
   * are invisible to the detector, which resolves speakers via
   * `game.actors.get(speaker.actor)` (always the base).
   */
  private get baseActor(): AnyActor {
    const a = this.actor;
    return game.actors.get(a.id) ?? a;
  }

  get title(): string {
    const isNPC = !this.actor.hasPlayerOwner;
    const key = isNPC ? 'GLUC.Actor.ModalTitleNPC' : 'GLUC.Actor.ModalTitlePC';
    return game.i18n.format(key, { name: this.actor.name ?? 'Actor' });
  }

  getData(): object {
    const flags = readActorFlags(this.baseActor);
    const isNPC = !this.actor.hasPlayerOwner;
    return {
      isNPC,
      isGM: game.user.isGM,
      data: {
        enabled: flags.enabled ?? false,
        portraitOverride: flags.portraitOverride ?? '',
      },
    };
  }

  activateListeners(html: JQueryLike): void {
    super.activateListeners(html);
    html.find('.gluc-test-button').on('click', () => {
      void this.runTest(false);
    });
    html.find('.gluc-broadcast-button').on('click', () => {
      void this.runTest(true);
    });
  }

  private async runTest(broadcast: boolean): Promise<void> {
    const base = this.baseActor;
    const event = resolveCritEvent({
      messageId: `${broadcast ? 'manual' : 'test'}-${Date.now()}`,
      actorId: base.id,
      isPC: base.hasPlayerOwner,
      originUserId: game.user.id,
    });
    if (!event) return;
    if (broadcast) broadcastCrit(event);
    try {
      await runCinematic(event);
    } catch (err) {
      console.error(`${MODULE_ID} | ${broadcast ? 'broadcast' : 'test'} cinematic failed:`, err);
    }
  }

  async _updateObject(_event: Event, formData: Record<string, unknown>): Promise<void> {
    const base = this.baseActor;
    const isNPC = !base.hasPlayerOwner;
    const enabled = isNPC ? Boolean(formData.enabled) : true;
    await writeActorFlags(base, {
      enabled,
      portraitOverride: String(formData.portraitOverride ?? '') || null,
    });
  }
}

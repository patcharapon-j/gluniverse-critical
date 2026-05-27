import { resolveCritEvent } from '../cinematic/resolver';
import { runCinematic } from '../cinematic/runner';
import { MODULE_ID } from '../constants';
import { readActorFlags, writeActorFlags } from '../flags/actor-flags';
import { broadcastCrit } from '../sockets/broadcast';

interface AppV2Options {
  id?: string;
  tag?: string;
  classes?: string[];
  window?: { title?: string; contentClasses?: string[]; icon?: string | false };
  position?: { width?: number; height?: number | 'auto' };
  form?: { handler?: unknown; closeOnSubmit?: boolean; submitOnChange?: boolean };
  actions?: Record<string, unknown>;
}

interface AppV2Instance {
  render(force?: boolean | object, options?: object): Promise<unknown>;
  readonly element: HTMLElement;
  options: AppV2Options;
}

declare const foundry: {
  applications: {
    api: {
      ApplicationV2: new (options?: AppV2Options) => AppV2Instance;
      HandlebarsApplicationMixin: <T extends abstract new (...args: any[]) => any>(base: T) => T;
    };
  };
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

const Base = foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
);

export class ActorConfigModal extends Base {
  #actor: AnyActor;

  static DEFAULT_OPTIONS: AppV2Options = {
    id: `${MODULE_ID}-actor-config`,
    tag: 'form',
    classes: ['gluc-actor-config'],
    window: { title: 'GLUC.Actor.HeaderButton', icon: 'fa-solid fa-bolt' },
    position: { width: 480, height: 'auto' },
    form: {
      handler: ActorConfigModal.#onSubmit,
      closeOnSubmit: true,
      submitOnChange: false,
    },
    actions: {
      test: ActorConfigModal.#onTest,
      broadcast: ActorConfigModal.#onBroadcast,
    },
  };

  static PARTS = {
    form: { template: `modules/${MODULE_ID}/templates/actor-config.html` },
  };

  constructor(actor: AnyActor, options: AppV2Options = {}) {
    super(options);
    this.#actor = actor;
  }

  get actor(): AnyActor {
    return this.#actor;
  }

  /**
   * Always operate on the world (base) actor, not a synthetic token-actor.
   * Synthetic actors write flags to the token's delta — those overrides
   * are invisible to the detector, which resolves speakers via
   * `game.actors.get(speaker.actor)` (always the base).
   */
  get #baseActor(): AnyActor {
    const a = this.#actor;
    return game.actors.get(a.id) ?? a;
  }

  get title(): string {
    const isNPC = !this.#actor.hasPlayerOwner;
    const key = isNPC ? 'GLUC.Actor.ModalTitleNPC' : 'GLUC.Actor.ModalTitlePC';
    return game.i18n.format(key, { name: this.#actor.name ?? 'Actor' });
  }

  async _prepareContext(): Promise<object> {
    const flags = readActorFlags(this.#baseActor);
    const isNPC = !this.#actor.hasPlayerOwner;
    return {
      isNPC,
      isGM: game.user.isGM,
      data: {
        enabled: flags.enabled ?? false,
        portraitOverride: flags.portraitOverride ?? '',
      },
    };
  }

  static async #onSubmit(
    this: ActorConfigModal,
    _event: Event,
    _form: HTMLFormElement,
    formData: { object: Record<string, unknown> },
  ): Promise<void> {
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 binds `this` to the instance when invoking form/action handlers.
    const base = this.#baseActor;
    const isNPC = !base.hasPlayerOwner;
    const data = formData.object;
    const enabled = isNPC ? Boolean(data.enabled) : true;
    await writeActorFlags(base, {
      enabled,
      portraitOverride: String(data.portraitOverride ?? '') || null,
    });
  }

  static #onTest(this: ActorConfigModal): void {
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 binds `this` to the instance when invoking form/action handlers.
    void this.#runTest(false);
  }

  static #onBroadcast(this: ActorConfigModal): void {
    // biome-ignore lint/complexity/noThisInStatic: ApplicationV2 binds `this` to the instance when invoking form/action handlers.
    void this.#runTest(true);
  }

  async #runTest(broadcast: boolean): Promise<void> {
    const base = this.#baseActor;
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
}

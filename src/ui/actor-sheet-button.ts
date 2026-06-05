import { MODULE_ID } from '../constants';
import { ActorConfigModal } from './actor-config-modal';

declare const Hooks: {
  on(name: string, fn: (...args: any[]) => unknown): void;
  once(name: string, fn: (...args: any[]) => unknown): void;
};
declare const game: {
  user: { isGM: boolean };
  i18n: { localize(key: string): string };
  modules?: { get(id: string): { api?: unknown; active?: boolean } | undefined };
};

type AnyActor = {
  id: string;
  type?: string;
  hasPlayerOwner?: boolean;
  isOwner?: boolean;
};

type AnyActorSheet = {
  actor?: AnyActor;
  document?: AnyActor;
};

type HeaderControlEntry = {
  action: string;
  icon: string;
  label: string;
  visible?: boolean;
};

type HeaderButtonEntry = {
  class: string;
  icon: string;
  label: string;
  onclick: (event?: Event) => void;
};

// --- Tidy 5e Sheets API surface we use (kgar/foundry-vtt-tidy-5e-sheets) ---
// `this` inside the callbacks is bound to the Tidy ApplicationV2 sheet instance.
type TidyAppContext = { document?: AnyActor; actor?: AnyActor };
type TidyHeaderControl = {
  icon: string;
  label: string;
  position?: 'menu' | 'header';
  ownership?: string | number;
  visible?: boolean | ((this: TidyAppContext) => boolean);
  onClickAction?: (this: TidyAppContext, event?: Event, target?: HTMLElement) => unknown;
};
type TidyApi = {
  registerActorHeaderControls?(params: { controls: TidyHeaderControl[] }): void;
};

const ACTION = `${MODULE_ID}-open-config`;
const HEADER_BTN_CLASS = `${MODULE_ID}-header-btn`;
const WIRED_ATTR = 'glucWired';

function canConfigure(actor: AnyActor): boolean {
  return Boolean(actor.isOwner) || game.user.isGM;
}

function openConfig(actor: AnyActor, event?: Event): void {
  event?.preventDefault();
  event?.stopPropagation();
  new ActorConfigModal(actor as never).render(true);
}

const TIDY_MODULE_ID = 'tidy5e-sheet';

/**
 * Whether a sheet is a Tidy 5e sheet. Tidy renders a custom Svelte header that
 * does not surface our core header-hook button, so it is handled via Tidy's own
 * API and skipped by the generic V2 hooks to avoid a duplicate button.
 */
function isTidySheet(app: unknown): boolean {
  const a = app as { constructor?: { name?: string }; options?: { classes?: string[] } } | null;
  if (a?.constructor?.name?.includes('Tidy')) return true;
  const classes = a?.options?.classes;
  return Array.isArray(classes) && classes.includes(TIDY_MODULE_ID);
}

function getTidyApi(): TidyApi | undefined {
  return game.modules?.get(TIDY_MODULE_ID)?.api as TidyApi | undefined;
}

let tidyControlsRegistered = false;

function registerTidyHeaderControls(api: TidyApi | undefined): void {
  if (tidyControlsRegistered || typeof api?.registerActorHeaderControls !== 'function') return;
  tidyControlsRegistered = true;

  api.registerActorHeaderControls({
    controls: [
      {
        icon: 'fa-solid fa-bolt',
        // Tidy localizes header-control labels; passing the already-localized
        // string is a no-op if it tries again, so this is safe either way.
        label: game.i18n.localize('GLUC.Actor.HeaderButton'),
        position: 'header',
        visible(this: TidyAppContext) {
          const actor = this?.document ?? this?.actor;
          return !!actor && canConfigure(actor);
        },
        onClickAction(this: TidyAppContext, event) {
          const actor = this?.document ?? this?.actor;
          if (actor) openConfig(actor, event);
        },
      },
    ],
  });
}

/**
 * The PF2e PC and NPC sheets are still ApplicationV1 (`ActorSheet`) on Foundry
 * v13/v14 — they use `_updateObject`/`_onDrop`, not the V2 lifecycle. V1 sheets
 * never fire the `getHeaderControlsActorSheetV2` / `renderActorSheetV2` hooks, so
 * an earlier V2-only implementation left no button at all. The reliable path for
 * V1 sheets is the `getActorSheetHeaderButtons` hook, which fires for every
 * `ActorSheet` subclass and supports a native `onclick`, so we register there.
 *
 * We also keep the V2 hooks below so the button keeps working for any sheet that
 * is (or becomes) ApplicationV2. A V1 sheet only fires the V1 hooks and a V2
 * sheet only fires the V2 hooks, so the two paths never double up.
 *
 * Tidy 5e Sheets (the popular D&D 5e sheet replacement) is ApplicationV2 but
 * renders its own Svelte header and ignores the core header-control hooks, so
 * the V2 paths leave no button there. We register the button through Tidy's
 * dedicated API instead and skip Tidy sheets in the generic V2 hooks so the two
 * mechanisms can't produce a duplicate.
 */
export function registerActorSheetHooks(): void {
  // --- Tidy 5e Sheets (custom header; uses its own registration API) ---
  registerTidyHeaderControls(getTidyApi());
  Hooks.once('tidy5e-sheet.ready', (api: TidyApi) => registerTidyHeaderControls(api));

  // --- ApplicationV1 actor sheets (PF2e PC + NPC) ---
  Hooks.on('getActorSheetHeaderButtons', (app: AnyActorSheet, buttons: HeaderButtonEntry[]) => {
    const actor = app.actor ?? app.document;
    if (!actor) return;
    if (!canConfigure(actor)) return;
    if (buttons.some((b) => b.class === HEADER_BTN_CLASS)) return;
    buttons.unshift({
      class: HEADER_BTN_CLASS,
      icon: 'fa-solid fa-bolt',
      label: game.i18n.localize('GLUC.Actor.HeaderButton'),
      onclick: (event) => openConfig(actor, event),
    });
  });

  // --- ApplicationV2 actor sheets (forward compatibility) ---
  Hooks.on(
    'getHeaderControlsActorSheetV2',
    (app: AnyActorSheet, controls: HeaderControlEntry[]) => {
      if (isTidySheet(app)) return;
      const actor = app.actor ?? app.document;
      if (!actor) return;
      if (!canConfigure(actor)) return;
      if (controls.some((c) => c.action === ACTION)) return;
      controls.push({
        action: ACTION,
        icon: 'fa-solid fa-bolt',
        label: 'GLUC.Actor.HeaderButton',
        visible: true,
      });
    },
  );

  Hooks.on('renderActorSheetV2', (sheet: AnyActorSheet, element: HTMLElement) => {
    if (isTidySheet(sheet)) return;
    const actor = sheet.actor ?? sheet.document;
    if (!actor) return;
    if (!canConfigure(actor)) return;

    const existing = element.querySelector<HTMLElement>(`[data-action="${ACTION}"]`);
    if (existing) {
      if (existing.dataset[WIRED_ATTR] !== '1') {
        existing.dataset[WIRED_ATTR] = '1';
        existing.addEventListener('click', (event) => openConfig(actor, event));
      }
      return;
    }

    const header = element.querySelector('.window-header');
    if (!header || header.querySelector(`.${HEADER_BTN_CLASS}`)) return;

    const label = game.i18n.localize('GLUC.Actor.HeaderButton');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `header-control icon fa-solid fa-bolt ${HEADER_BTN_CLASS}`;
    btn.dataset.action = ACTION;
    btn.dataset[WIRED_ATTR] = '1';
    btn.dataset.tooltip = label;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', (event) => openConfig(actor, event));

    const closeBtn = header.querySelector('[data-action="close"]');
    if (closeBtn) header.insertBefore(btn, closeBtn);
    else header.appendChild(btn);
  });
}

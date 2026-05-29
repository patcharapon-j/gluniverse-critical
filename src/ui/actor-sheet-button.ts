import { MODULE_ID } from '../constants';
import { ActorConfigModal } from './actor-config-modal';

declare const Hooks: {
  on(name: string, fn: (...args: any[]) => unknown): void;
};
declare const game: {
  user: { isGM: boolean };
  i18n: { localize(key: string): string };
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
 */
export function registerActorSheetHooks(): void {
  // --- ApplicationV1 actor sheets (PF2e PC + NPC) ---
  Hooks.on(
    'getActorSheetHeaderButtons',
    (app: AnyActorSheet, buttons: HeaderButtonEntry[]) => {
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
    },
  );

  // --- ApplicationV2 actor sheets (forward compatibility) ---
  Hooks.on(
    'getHeaderControlsActorSheetV2',
    (app: AnyActorSheet, controls: HeaderControlEntry[]) => {
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

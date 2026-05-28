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

const ACTION = `${MODULE_ID}-open-config`;
const HEADER_BTN_CLASS = `${MODULE_ID}-header-btn`;
const WIRED_ATTR = 'glucWired';

function canConfigure(actor: AnyActor): boolean {
  return Boolean(actor.isOwner) || game.user.isGM;
}

function openConfig(actor: AnyActor, event: Event): void {
  event.preventDefault();
  event.stopPropagation();
  new ActorConfigModal(actor as never).render(true);
}

/**
 * V13 ApplicationV2 renders custom header controls into the `.controls-dropdown`
 * menu via the `getHeaderControls<Class>` hook. Under Foundry v14, PF2e's actor
 * sheets no longer surface entries pushed through that hook as a visible button,
 * so the hook alone leaves nothing for players to click. We still register the
 * entry (so v13 gets the native dropdown item), but on `renderActorSheetV2` we
 * fall back to injecting a header-control button when the hook produced none.
 *
 * `ApplicationHeaderControlsEntry` has no `onClick` field, so we wire the click
 * in the render hook regardless of which path created the button.
 */
export function registerActorSheetHooks(): void {
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

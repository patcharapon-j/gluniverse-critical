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

const HEADER_BTN_CLASS = `${MODULE_ID}-header-btn`;

/**
 * PF2e actor sheets are ApplicationV2 in v13+, where the legacy
 * `getActorSheetHeaderButtons` hook no longer fires. ApplicationV2 header
 * controls also can't run a custom click handler on a sheet we don't own, so
 * we inject the button into the rendered window header on `renderActorSheetV2`
 * (which fires for every ActorSheetV2 subclass, PF2e's included).
 */
export function registerActorSheetHooks(): void {
  Hooks.on('renderActorSheetV2', (sheet: AnyActorSheet, element: HTMLElement) => {
    const actor = sheet.actor ?? sheet.document;
    if (!actor) return;

    const canOpen = actor.isOwner || game.user.isGM;
    if (!canOpen) return;

    const header = element.querySelector('.window-header');
    if (!header) return;
    if (header.querySelector(`.${HEADER_BTN_CLASS}`)) return;

    const label = game.i18n.localize('GLUC.Actor.HeaderButton');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `header-control icon fa-solid fa-bolt ${HEADER_BTN_CLASS}`;
    btn.dataset.tooltip = label;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      new ActorConfigModal(actor as never).render(true);
    });

    const closeBtn = header.querySelector('[data-action="close"]');
    if (closeBtn) header.insertBefore(btn, closeBtn);
    else header.appendChild(btn);
  });
}

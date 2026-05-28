import { MODULE_ID } from '../constants';
import { ActorConfigModal } from './actor-config-modal';

declare const Hooks: {
  on(name: string, fn: (...args: any[]) => unknown): void;
};
declare const game: {
  user: { isGM: boolean };
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
const WIRED_ATTR = 'glucWired';

/**
 * V13 ApplicationV2 renders custom header controls into the `.controls-dropdown`
 * menu via the `getHeaderControls<Class>` hook. Injecting a raw button into
 * `.window-header` (the previous approach) placed it inline next to the close
 * control instead of in the dropdown, breaking the standard sheet layout.
 *
 * `ApplicationHeaderControlsEntry` has no `onClick` field, so the entry only
 * declares an `action`; we wire the actual click on `renderActorSheetV2` since
 * we don't own the sheet's `actions` map.
 */
export function registerActorSheetHooks(): void {
  Hooks.on(
    'getHeaderControlsActorSheetV2',
    (app: AnyActorSheet, controls: HeaderControlEntry[]) => {
      const actor = app.actor ?? app.document;
      if (!actor) return;
      if (!actor.isOwner && !game.user.isGM) return;
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
    const btn = element.querySelector<HTMLElement>(`[data-action="${ACTION}"]`);
    if (!btn || btn.dataset[WIRED_ATTR] === '1') return;
    btn.dataset[WIRED_ATTR] = '1';
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      new ActorConfigModal(actor as never).render(true);
    });
  });
}

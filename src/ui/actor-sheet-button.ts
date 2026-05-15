import { MODULE_ID } from '../constants';
import { ActorConfigModal } from './actor-config-modal';

declare const Hooks: {
  on(name: string, fn: (...args: any[]) => unknown): void;
};
declare const game: {
  user: { isGM: boolean };
};

type SheetHeaderButton = {
  label: string;
  class: string;
  icon: string;
  onclick: () => void;
};

type AnyActorSheet = {
  actor: {
    id: string;
    type?: string;
    hasPlayerOwner?: boolean;
    isOwner?: boolean;
  };
};

export function registerActorSheetHooks(): void {
  Hooks.on('getActorSheetHeaderButtons', (sheet: AnyActorSheet, buttons: SheetHeaderButton[]) => {
    const actor = sheet.actor;
    if (!actor) return;
    const canOpen = actor.isOwner || game.user.isGM;
    if (!canOpen) return;
    buttons.unshift({
      label: 'GLUC.Actor.HeaderButton',
      class: `${MODULE_ID}-header-btn`,
      icon: 'fas fa-bolt',
      onclick: () => {
        new ActorConfigModal(actor as never).render(true);
      },
    });
  });
}

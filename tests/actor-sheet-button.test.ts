import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  render: vi.fn(),
  ctor: vi.fn(),
}));

vi.mock('../src/ui/actor-config-modal', () => ({
  ActorConfigModal: class {
    constructor(...args: unknown[]) {
      mocks.ctor(...args);
    }
    render = mocks.render;
  },
}));

type Hook = (...args: unknown[]) => unknown;

function setup(isGM = false, tidyApi?: unknown) {
  const hooks = new Map<string, Hook>();
  (globalThis as { Hooks?: unknown }).Hooks = {
    on: vi.fn((name: string, fn: Hook) => {
      hooks.set(name, fn);
    }),
    once: vi.fn((name: string, fn: Hook) => {
      hooks.set(name, fn);
    }),
  };
  (globalThis as { game?: unknown }).game = {
    user: { isGM },
    i18n: { localize: (key: string) => key },
    modules: {
      get: (id: string) =>
        id === 'tidy5e-sheet' && tidyApi ? { api: tidyApi, active: true } : undefined,
    },
  };
  return hooks;
}

describe('actor sheet header button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds a V1 header button for owned PF2e actor sheets (getActorSheetHeaderButtons)', async () => {
    const hooks = setup(false);
    const { registerActorSheetHooks } = await import('../src/ui/actor-sheet-button');
    registerActorSheetHooks();

    const buttons: Array<{ class: string; onclick: (e?: Event) => void }> = [
      { class: 'close', onclick: () => {} },
    ];
    const actor = { id: 'a1', isOwner: true };
    hooks.get('getActorSheetHeaderButtons')?.({ actor }, buttons);

    expect(buttons).toHaveLength(2);
    const added = buttons[0] as { class: string; onclick: (e?: Event) => void };
    expect(added.class).toBe('gluniverse-critical-header-btn');

    added.onclick();
    expect(mocks.ctor).toHaveBeenCalledWith(actor);
    expect(mocks.render).toHaveBeenCalledWith(true);
  });

  it('does not add the V1 button when the user cannot configure the actor', async () => {
    const hooks = setup(false);
    const { registerActorSheetHooks } = await import('../src/ui/actor-sheet-button');
    registerActorSheetHooks();

    const buttons: Array<{ class: string }> = [{ class: 'close' }];
    hooks.get('getActorSheetHeaderButtons')?.({ actor: { id: 'a1', isOwner: false } }, buttons);

    expect(buttons).toHaveLength(1);
  });

  it('does not duplicate the V1 button if it is already present', async () => {
    const hooks = setup(true);
    const { registerActorSheetHooks } = await import('../src/ui/actor-sheet-button');
    registerActorSheetHooks();

    const buttons: Array<{ class: string }> = [
      { class: 'gluniverse-critical-header-btn' },
      { class: 'close' },
    ];
    hooks.get('getActorSheetHeaderButtons')?.({ document: { id: 'a1' } }, buttons);

    expect(buttons.filter((b) => b.class === 'gluniverse-critical-header-btn')).toHaveLength(1);
  });

  it('registers a header control through the Tidy 5e Sheets API', async () => {
    const registerActorHeaderControls = vi.fn();
    setup(false, { registerActorHeaderControls });
    const { registerActorSheetHooks } = await import('../src/ui/actor-sheet-button');
    registerActorSheetHooks();

    expect(registerActorHeaderControls).toHaveBeenCalledTimes(1);
    const control = registerActorHeaderControls.mock.calls.at(0)?.[0]?.controls?.[0];
    expect(control?.position).toBe('header');
    expect(control?.icon).toBe('fa-solid fa-bolt');

    // Tidy binds `this` to the sheet instance; the actor is `this.document`.
    const actor = { id: 'a1', isOwner: true };
    expect(control?.visible.call({ document: actor })).toBe(true);
    expect(control?.visible.call({ document: { id: 'a2', isOwner: false } })).toBe(false);

    control?.onClickAction.call({ document: actor });
    expect(mocks.ctor).toHaveBeenCalledWith(actor);
    expect(mocks.render).toHaveBeenCalledWith(true);
  });

  it('skips Tidy sheets in the generic V2 header-control hook (no duplicate)', async () => {
    const hooks = setup(true);
    const { registerActorSheetHooks } = await import('../src/ui/actor-sheet-button');
    registerActorSheetHooks();

    const controls: Array<{ action: string }> = [];
    // A Tidy sheet identified by its constructor name.
    class Tidy5eCharacterSheetQuadrone {
      actor = { id: 'a1', isOwner: true };
    }
    hooks.get('getHeaderControlsActorSheetV2')?.(new Tidy5eCharacterSheetQuadrone(), controls);

    expect(controls).toHaveLength(0);
  });
});

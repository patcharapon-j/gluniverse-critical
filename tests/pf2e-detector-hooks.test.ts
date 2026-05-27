import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS } from '../src/constants';
import type { CritEvent } from '../src/types/module';

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  broadcastCrit: vi.fn(),
  resolveCritEvent: vi.fn(),
}));

vi.mock('../src/cinematic/queue', () => ({
  enqueue: mocks.enqueue,
}));

vi.mock('../src/cinematic/resolver', () => ({
  resolveCritEvent: mocks.resolveCritEvent,
}));

vi.mock('../src/sockets/broadcast', () => ({
  broadcastCrit: mocks.broadcastCrit,
}));

vi.mock('../src/settings/settings', () => ({
  getSetting: vi.fn((key: string) => {
    switch (key) {
      case SETTINGS.TRIGGER_MODE:
        return 'pf2e';
      case SETTINGS.ENABLE_SKILL_CRITS:
        return true;
      case SETTINGS.ENABLE_PERCEPTION_CRITS:
        return false;
      default:
        return undefined;
    }
  }),
}));

const actor = {
  id: 'actor-1',
  hasPlayerOwner: true,
  getFlag: vi.fn(() => undefined),
};

const criticalMessage = {
  id: 'message-1',
  author: { id: 'player-1' },
  speaker: { actor: 'actor-1' },
  rollMode: 'publicroll',
  whisper: [],
  blind: false,
  flags: { pf2e: { context: { type: 'attack-roll', outcome: 'criticalSuccess' } } },
  rolls: [],
};

describe('pf2e detector hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const hooks = new Map<string, (...args: unknown[]) => unknown>();
    (globalThis as { Hooks?: unknown }).Hooks = {
      on: vi.fn((name: string, fn: (...args: unknown[]) => unknown) => {
        hooks.set(name, fn);
      }),
    };
    (globalThis as { game?: unknown }).game = {
      system: { id: 'pf2e' },
      user: { id: 'player-1', isGM: false },
      dice3d: {},
      actors: { get: vi.fn(() => actor) },
      messages: {
        get: vi.fn((id: string) => (id === criticalMessage.id ? criticalMessage : undefined)),
      },
      settings: { get: vi.fn() },
    };
    (globalThis as { __hooks?: typeof hooks }).__hooks = hooks;

    mocks.resolveCritEvent.mockReturnValue({
      messageId: 'message-1',
      actorId: 'actor-1',
      actorName: 'Valeros',
      isPC: true,
      imagePath: 'actor.png',
      durationMs: 1000,
      mode: 'standard',
      startTimestamp: 1,
      originUserId: 'player-1',
    } satisfies CritEvent);
  });

  it('processes Dice So Nice completed player rolls from the Foundry chat collection', async () => {
    const { registerDetector } = await import('../src/detector/pf2e-detector');

    registerDetector();
    const hooks = (
      globalThis as unknown as { __hooks: Map<string, (...args: unknown[]) => unknown> }
    ).__hooks;
    hooks.get('diceSoNiceRollComplete')?.('message-1');

    expect(mocks.resolveCritEvent).toHaveBeenCalledWith({
      messageId: 'message-1',
      actorId: 'actor-1',
      isPC: true,
      originUserId: 'player-1',
    });
    expect(mocks.enqueue).toHaveBeenCalledTimes(1);
    expect(mocks.broadcastCrit).toHaveBeenCalledTimes(1);
  });
});

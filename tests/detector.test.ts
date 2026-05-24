import { describe, expect, it } from 'vitest';
import type { DetectorInput } from '../src/detector/types';

import { detect } from '../src/detector/detect';

function base(): DetectorInput {
  return {
    systemId: 'pf2e',
    context: { type: 'attack-roll', outcome: 'criticalSuccess' },
    rollMode: 'publicroll',
    whisperLength: 0,
    blind: false,
    hasActor: true,
    actorHasPlayerOwner: true,
    npcEnabled: false,
    triggerMode: 'pf2e',
    nat20Detected: false,
    skillCritsEnabled: true,
    perceptionCritsEnabled: false,
  };
}

describe('pf2e detector', () => {
  it('fires on PC critical Strike', () => {
    expect(detect(base())).toEqual({ fire: true, reason: 'pf2e-critical-success' });
  });

  it('fires on PC critical Spell Attack', () => {
    expect(
      detect({ ...base(), context: { type: 'spell-attack-roll', outcome: 'criticalSuccess' } }),
    ).toEqual({ fire: true, reason: 'pf2e-critical-success' });
  });

  it('fires on PC critical Save', () => {
    expect(
      detect({ ...base(), context: { type: 'saving-throw', outcome: 'criticalSuccess' } }),
    ).toEqual({ fire: true, reason: 'pf2e-critical-success' });
  });

  it('rejects non-critical success outcome', () => {
    expect(detect({ ...base(), context: { type: 'attack-roll', outcome: 'success' } })).toEqual({
      fire: false,
      reason: 'not-critical-success',
    });
  });

  it('rejects non-PF2e systems', () => {
    expect(detect({ ...base(), systemId: 'dnd5e' })).toEqual({
      fire: false,
      reason: 'wrong-system',
    });
  });

  it('rejects blind GM rolls', () => {
    expect(detect({ ...base(), rollMode: 'blindroll' })).toEqual({
      fire: false,
      reason: 'secret-or-blind-roll',
    });
  });

  it('fires on whispered GM-mode rolls (broadcast is gated separately)', () => {
    expect(detect({ ...base(), rollMode: 'gmroll', whisperLength: 1 })).toEqual({
      fire: true,
      reason: 'pf2e-critical-success',
    });
  });

  it('rejects blind flag', () => {
    expect(detect({ ...base(), blind: true })).toEqual({
      fire: false,
      reason: 'secret-or-blind-roll',
    });
  });

  it('hard-blocks flat checks', () => {
    expect(
      detect({ ...base(), context: { type: 'flat-check', outcome: 'criticalSuccess' } }),
    ).toEqual({ fire: false, reason: 'flat-check-blocked' });
  });

  it('hard-blocks damage rolls', () => {
    expect(
      detect({ ...base(), context: { type: 'damage-roll', outcome: 'criticalSuccess' } }),
    ).toEqual({ fire: false, reason: 'damage-or-initiative-blocked' });
  });

  it('hard-blocks initiative', () => {
    expect(
      detect({ ...base(), context: { type: 'initiative', outcome: 'criticalSuccess' } }),
    ).toEqual({ fire: false, reason: 'damage-or-initiative-blocked' });
  });

  it('respects skill-crits-disabled setting', () => {
    expect(
      detect({
        ...base(),
        context: { type: 'skill-check', outcome: 'criticalSuccess' },
        skillCritsEnabled: false,
      }),
    ).toEqual({ fire: false, reason: 'skill-crits-disabled' });
  });

  it('fires on skill crits when enabled', () => {
    expect(
      detect({
        ...base(),
        context: { type: 'skill-check', outcome: 'criticalSuccess' },
        skillCritsEnabled: true,
      }),
    ).toEqual({ fire: true, reason: 'pf2e-critical-success' });
  });

  it('blocks perception by default', () => {
    expect(
      detect({
        ...base(),
        context: { type: 'perception-check', outcome: 'criticalSuccess' },
      }),
    ).toEqual({ fire: false, reason: 'perception-crits-disabled' });
  });

  it('fires perception when enabled', () => {
    expect(
      detect({
        ...base(),
        context: { type: 'perception-check', outcome: 'criticalSuccess' },
        perceptionCritsEnabled: true,
      }),
    ).toEqual({ fire: true, reason: 'pf2e-critical-success' });
  });

  it('rejects NPC crit when not opted in', () => {
    expect(detect({ ...base(), actorHasPlayerOwner: false, npcEnabled: false })).toEqual({
      fire: false,
      reason: 'npc-not-enabled',
    });
  });

  it('fires NPC crit when opted in', () => {
    expect(detect({ ...base(), actorHasPlayerOwner: false, npcEnabled: true })).toEqual({
      fire: true,
      reason: 'pf2e-critical-success',
    });
  });

  it('rejects messages with no actor', () => {
    expect(detect({ ...base(), hasActor: false })).toEqual({
      fire: false,
      reason: 'no-actor',
    });
  });

  it('rejects missing context', () => {
    expect(detect({ ...base(), context: null })).toEqual({
      fire: false,
      reason: 'no-context',
    });
  });

  it('rejects unsupported roll types', () => {
    expect(
      detect({ ...base(), context: { type: 'something-weird', outcome: 'criticalSuccess' } }),
    ).toEqual({ fire: false, reason: 'unsupported-roll-type' });
  });

  describe('ungraded nat20 in pf2e mode (no target / no DC)', () => {
    it('fires on an untargeted attack-roll nat20 with no outcome', () => {
      expect(detect({ ...base(), context: { type: 'attack-roll' }, nat20Detected: true })).toEqual({
        fire: true,
        reason: 'nat20',
      });
    });

    it('fires on an untargeted saving-throw nat20 with no outcome', () => {
      expect(detect({ ...base(), context: { type: 'saving-throw' }, nat20Detected: true })).toEqual(
        { fire: true, reason: 'nat20' },
      );
    });

    it('fires on an ungraded skill-check nat20 when skill crits enabled', () => {
      expect(
        detect({
          ...base(),
          context: { type: 'skill-check' },
          nat20Detected: true,
          skillCritsEnabled: true,
        }),
      ).toEqual({ fire: true, reason: 'nat20' });
    });

    it('does not fire on an ungraded roll without a nat20', () => {
      expect(detect({ ...base(), context: { type: 'attack-roll' }, nat20Detected: false })).toEqual(
        { fire: false, reason: 'not-critical-success' },
      );
    });

    it('does not fire when a graded success (not crit) has a nat20', () => {
      expect(
        detect({
          ...base(),
          context: { type: 'attack-roll', outcome: 'success' },
          nat20Detected: true,
        }),
      ).toEqual({ fire: false, reason: 'not-critical-success' });
    });

    it('still hard-blocks initiative on a nat20 with no outcome', () => {
      expect(detect({ ...base(), context: { type: 'initiative' }, nat20Detected: true })).toEqual({
        fire: false,
        reason: 'damage-or-initiative-blocked',
      });
    });

    it('still respects skill-crits-disabled on an ungraded skill nat20', () => {
      expect(
        detect({
          ...base(),
          context: { type: 'skill-check' },
          nat20Detected: true,
          skillCritsEnabled: false,
        }),
      ).toEqual({ fire: false, reason: 'skill-crits-disabled' });
    });
  });

  describe('nat20-only mode', () => {
    it('fires on any nat20 regardless of outcome or roll type', () => {
      expect(
        detect({
          ...base(),
          triggerMode: 'nat20',
          nat20Detected: true,
          context: { type: 'damage-roll', outcome: 'success' },
        }),
      ).toEqual({ fire: true, reason: 'nat20' });
    });

    it('fires without context as long as nat20 is present', () => {
      expect(
        detect({ ...base(), triggerMode: 'nat20', nat20Detected: true, context: null }),
      ).toEqual({ fire: true, reason: 'nat20' });
    });

    it('rejects when no nat20 is rolled', () => {
      expect(
        detect({
          ...base(),
          triggerMode: 'nat20',
          nat20Detected: false,
          context: { type: 'attack-roll', outcome: 'criticalSuccess' },
        }),
      ).toEqual({ fire: false, reason: 'not-nat20' });
    });

    it('still respects NPC enable flag', () => {
      expect(
        detect({
          ...base(),
          triggerMode: 'nat20',
          nat20Detected: true,
          actorHasPlayerOwner: false,
          npcEnabled: false,
        }),
      ).toEqual({ fire: false, reason: 'npc-not-enabled' });
    });

    it('still blocks blind rolls', () => {
      expect(
        detect({ ...base(), triggerMode: 'nat20', nat20Detected: true, rollMode: 'blindroll' }),
      ).toEqual({ fire: false, reason: 'secret-or-blind-roll' });
    });
  });
});

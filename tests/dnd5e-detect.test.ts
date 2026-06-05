import { describe, expect, it } from 'vitest';
import { detectDnd5e } from '../src/detector/dnd5e-detect';
import type { DetectorInput } from '../src/detector/types';

function base(): DetectorInput {
  return {
    systemId: 'dnd5e',
    context: null,
    dnd5eRoll: { type: 'attack' },
    criticalHit: true,
    rollMode: 'publicroll',
    whisperLength: 0,
    blind: false,
    hasActor: true,
    actorHasPlayerOwner: true,
    npcEnabled: false,
    triggerMode: 'dnd5e',
    nat20Detected: false,
    skillCritsEnabled: true,
    perceptionCritsEnabled: false,
  };
}

describe('dnd5e detector', () => {
  it('fires on a PC critical attack hit', () => {
    expect(detectDnd5e(base())).toEqual({ fire: true, reason: 'dnd5e-critical-hit' });
  });

  it('rejects a non-critical attack', () => {
    expect(detectDnd5e({ ...base(), criticalHit: false, nat20Detected: false })).toEqual({
      fire: false,
      reason: 'not-critical-hit',
    });
  });

  it('falls back to a natural 20 when the crit threshold is unknown', () => {
    expect(detectDnd5e({ ...base(), criticalHit: undefined, nat20Detected: true })).toEqual({
      fire: true,
      reason: 'dnd5e-critical-hit',
    });
  });

  it('still fires an attack crit on a 19 (Improved Critical) without a nat20', () => {
    // criticalHit is computed upstream from the d20 threshold; a 19 crit arrives
    // here as criticalHit:true with nat20Detected:false.
    expect(detectDnd5e({ ...base(), criticalHit: true, nat20Detected: false })).toEqual({
      fire: true,
      reason: 'dnd5e-critical-hit',
    });
  });

  it('rejects non-dnd5e systems', () => {
    expect(detectDnd5e({ ...base(), systemId: 'pf2e' })).toEqual({
      fire: false,
      reason: 'wrong-system',
    });
  });

  it('rejects blind rolls', () => {
    expect(detectDnd5e({ ...base(), blind: true })).toEqual({
      fire: false,
      reason: 'secret-or-blind-roll',
    });
    expect(detectDnd5e({ ...base(), rollMode: 'blindroll' })).toEqual({
      fire: false,
      reason: 'secret-or-blind-roll',
    });
  });

  it('fires on whispered GM-mode crits (broadcast gated separately)', () => {
    expect(detectDnd5e({ ...base(), rollMode: 'gmroll', whisperLength: 1 })).toEqual({
      fire: true,
      reason: 'dnd5e-critical-hit',
    });
  });

  it('hard-blocks damage rolls', () => {
    expect(detectDnd5e({ ...base(), dnd5eRoll: { type: 'damage' }, nat20Detected: true })).toEqual({
      fire: false,
      reason: 'damage-or-initiative-blocked',
    });
  });

  it('hard-blocks initiative', () => {
    expect(
      detectDnd5e({ ...base(), dnd5eRoll: { type: 'initiative' }, nat20Detected: true }),
    ).toEqual({ fire: false, reason: 'damage-or-initiative-blocked' });
  });

  describe('saving throws and death saves', () => {
    it('fires on a natural-20 save', () => {
      expect(
        detectDnd5e({
          ...base(),
          dnd5eRoll: { type: 'save', ability: 'dex' },
          nat20Detected: true,
        }),
      ).toEqual({ fire: true, reason: 'nat20' });
    });

    it('does not fire a save without a nat20', () => {
      expect(detectDnd5e({ ...base(), dnd5eRoll: { type: 'save' }, nat20Detected: false })).toEqual(
        { fire: false, reason: 'not-critical-hit' },
      );
    });

    it('fires on a natural-20 death save', () => {
      expect(detectDnd5e({ ...base(), dnd5eRoll: { type: 'death' }, nat20Detected: true })).toEqual(
        { fire: true, reason: 'nat20' },
      );
    });
  });

  describe('checks (ability / skill / tool)', () => {
    it('fires a nat-20 ability check when skill crits are enabled', () => {
      expect(
        detectDnd5e({
          ...base(),
          dnd5eRoll: { type: 'ability', ability: 'str' },
          nat20Detected: true,
        }),
      ).toEqual({ fire: true, reason: 'nat20' });
    });

    it('respects the skill-crits toggle for ability checks', () => {
      expect(
        detectDnd5e({
          ...base(),
          dnd5eRoll: { type: 'ability' },
          nat20Detected: true,
          skillCritsEnabled: false,
        }),
      ).toEqual({ fire: false, reason: 'skill-crits-disabled' });
    });

    it('fires a nat-20 skill check when enabled', () => {
      expect(
        detectDnd5e({
          ...base(),
          dnd5eRoll: { type: 'skill', skillId: 'ath' },
          nat20Detected: true,
        }),
      ).toEqual({ fire: true, reason: 'nat20' });
    });

    it('respects the skill-crits toggle for skill checks', () => {
      expect(
        detectDnd5e({
          ...base(),
          dnd5eRoll: { type: 'skill', skillId: 'ath' },
          nat20Detected: true,
          skillCritsEnabled: false,
        }),
      ).toEqual({ fire: false, reason: 'skill-crits-disabled' });
    });

    it('treats tool checks like skill checks', () => {
      expect(
        detectDnd5e({
          ...base(),
          dnd5eRoll: { type: 'tool' },
          nat20Detected: true,
          skillCritsEnabled: false,
        }),
      ).toEqual({ fire: false, reason: 'skill-crits-disabled' });
    });

    it('does not fire a check without a nat20', () => {
      expect(
        detectDnd5e({
          ...base(),
          dnd5eRoll: { type: 'skill', skillId: 'ath' },
          nat20Detected: false,
        }),
      ).toEqual({ fire: false, reason: 'not-critical-hit' });
    });
  });

  describe('perception (skill id "prc") uses the perception toggle', () => {
    it('blocks perception by default', () => {
      expect(
        detectDnd5e({
          ...base(),
          dnd5eRoll: { type: 'skill', skillId: 'prc' },
          nat20Detected: true,
        }),
      ).toEqual({ fire: false, reason: 'perception-crits-disabled' });
    });

    it('fires perception when the perception toggle is on', () => {
      expect(
        detectDnd5e({
          ...base(),
          dnd5eRoll: { type: 'skill', skillId: 'prc' },
          nat20Detected: true,
          perceptionCritsEnabled: true,
        }),
      ).toEqual({ fire: true, reason: 'nat20' });
    });

    it('is unaffected by the skill toggle being off', () => {
      expect(
        detectDnd5e({
          ...base(),
          dnd5eRoll: { type: 'skill', skillId: 'prc' },
          nat20Detected: true,
          skillCritsEnabled: false,
          perceptionCritsEnabled: true,
        }),
      ).toEqual({ fire: true, reason: 'nat20' });
    });
  });

  describe('actor scope', () => {
    it('rejects NPC crit when not opted in', () => {
      expect(detectDnd5e({ ...base(), actorHasPlayerOwner: false, npcEnabled: false })).toEqual({
        fire: false,
        reason: 'npc-not-enabled',
      });
    });

    it('fires NPC crit when opted in', () => {
      expect(detectDnd5e({ ...base(), actorHasPlayerOwner: false, npcEnabled: true })).toEqual({
        fire: true,
        reason: 'dnd5e-critical-hit',
      });
    });

    it('rejects messages with no actor', () => {
      expect(detectDnd5e({ ...base(), hasActor: false })).toEqual({
        fire: false,
        reason: 'no-actor',
      });
    });
  });

  it('rejects a missing roll flag', () => {
    expect(detectDnd5e({ ...base(), dnd5eRoll: null })).toEqual({
      fire: false,
      reason: 'no-context',
    });
  });

  it('rejects unsupported roll types', () => {
    expect(
      detectDnd5e({ ...base(), dnd5eRoll: { type: 'something-weird' }, nat20Detected: true }),
    ).toEqual({ fire: false, reason: 'unsupported-roll-type' });
  });

  describe('nat20-only mode', () => {
    it('fires on any nat20 regardless of roll type', () => {
      expect(
        detectDnd5e({
          ...base(),
          triggerMode: 'nat20',
          nat20Detected: true,
          dnd5eRoll: { type: 'damage' },
        }),
      ).toEqual({ fire: true, reason: 'nat20' });
    });

    it('rejects when no nat20 is rolled', () => {
      expect(
        detectDnd5e({ ...base(), triggerMode: 'nat20', nat20Detected: false, criticalHit: true }),
      ).toEqual({ fire: false, reason: 'not-nat20' });
    });

    it('still respects the NPC enable flag', () => {
      expect(
        detectDnd5e({
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
        detectDnd5e({
          ...base(),
          triggerMode: 'nat20',
          nat20Detected: true,
          rollMode: 'blindroll',
        }),
      ).toEqual({ fire: false, reason: 'secret-or-blind-roll' });
    });
  });
});

import { describe, expect, it } from 'vitest';
import { getAttackCriticalHit, hasNat20Result } from '../src/detector/dice';

describe('hasNat20Result', () => {
  it('detects an active natural 20 on a d20', () => {
    expect(hasNat20Result({ rolls: [{ dice: [{ faces: 20, results: [{ result: 20 }] }] }] })).toBe(
      true,
    );
  });

  it('ignores discarded / inactive dice (advantage)', () => {
    expect(
      hasNat20Result({
        rolls: [
          {
            dice: [
              {
                faces: 20,
                results: [
                  { result: 20, discarded: true },
                  { result: 11, active: true },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(false);
  });

  it('ignores non-d20 dice', () => {
    expect(hasNat20Result({ rolls: [{ dice: [{ faces: 6, results: [{ result: 6 }] }] }] })).toBe(
      false,
    );
  });

  it('returns false when there are no rolls', () => {
    expect(hasNat20Result({})).toBe(false);
  });
});

describe('getAttackCriticalHit', () => {
  it('is a crit on a natural 20 with the default threshold', () => {
    expect(
      getAttackCriticalHit({ rolls: [{ dice: [{ faces: 20, results: [{ result: 20 }] }] }] }),
    ).toBe(true);
  });

  it('is not a crit on a 19 with the default threshold', () => {
    expect(
      getAttackCriticalHit({ rolls: [{ dice: [{ faces: 20, results: [{ result: 19 }] }] }] }),
    ).toBe(false);
  });

  it('honours a lowered threshold (Improved Critical fires on 19)', () => {
    expect(
      getAttackCriticalHit({
        rolls: [
          { dice: [{ faces: 20, options: { criticalSuccess: 19 }, results: [{ result: 19 }] }] },
        ],
      }),
    ).toBe(true);
  });

  it('prefers the deserialized D20Roll.isCritical flag', () => {
    expect(
      getAttackCriticalHit({
        rolls: [{ isCritical: true, dice: [{ faces: 20, results: [{ result: 3 }] }] }],
      }),
    ).toBe(true);
  });

  it('evaluates the active die under advantage', () => {
    expect(
      getAttackCriticalHit({
        rolls: [
          {
            dice: [
              {
                faces: 20,
                results: [
                  { result: 5, discarded: true },
                  { result: 20, active: true },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it('returns undefined when there is no d20 to evaluate', () => {
    expect(
      getAttackCriticalHit({ rolls: [{ dice: [{ faces: 6, results: [{ result: 6 }] }] }] }),
    ).toBe(undefined);
  });
});

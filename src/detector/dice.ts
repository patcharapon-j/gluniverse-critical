// System-agnostic helpers for reading d20 dice out of a chat message's rolls.
// Used by both the PF2e and dnd5e detectors.

export type DieResult = { result?: number; active?: boolean; discarded?: boolean };
export type DieTerm = {
  faces?: number;
  results?: DieResult[];
  options?: { criticalSuccess?: number };
};
export type RollLike = { dice?: DieTerm[]; isCritical?: boolean };
export type RollMessageLike = { rolls?: RollLike[] };

function activeResults(die: DieTerm): DieResult[] {
  const results = die.results ?? [];
  return results.filter((r) => r.discarded !== true && r.active !== false);
}

/** True when any active d20 in the message shows a natural 20. */
export function hasNat20Result(message: RollMessageLike): boolean {
  const rolls = message.rolls;
  if (!Array.isArray(rolls)) return false;
  for (const roll of rolls) {
    const dice = roll.dice;
    if (!Array.isArray(dice)) continue;
    for (const die of dice) {
      if (die.faces !== 20) continue;
      if (activeResults(die).some((r) => r.result === 20)) return true;
    }
  }
  return false;
}

/**
 * Whether an attack roll is a mechanical critical hit.
 *
 * dnd5e marks a hit as critical when the active d20 meets or exceeds the
 * `criticalSuccess` threshold, which defaults to 20 but can be lowered (e.g. a
 * Champion's Improved Critical fires on 19–20). We prefer the deserialized
 * `D20Roll.isCritical` flag when present and otherwise fall back to comparing
 * the active d20 against its threshold.
 *
 * Returns `undefined` when the message has no d20 to evaluate.
 */
export function getAttackCriticalHit(message: RollMessageLike): boolean | undefined {
  const rolls = message.rolls;
  if (!Array.isArray(rolls)) return undefined;
  let sawD20 = false;
  for (const roll of rolls) {
    if (roll.isCritical === true) return true;
    const dice = roll.dice;
    if (!Array.isArray(dice)) continue;
    for (const die of dice) {
      if (die.faces !== 20) continue;
      sawD20 = true;
      const threshold = die.options?.criticalSuccess ?? 20;
      if (activeResults(die).some((r) => typeof r.result === 'number' && r.result >= threshold)) {
        return true;
      }
    }
  }
  return sawD20 ? false : undefined;
}

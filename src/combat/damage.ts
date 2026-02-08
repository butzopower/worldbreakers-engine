import { GameState } from '../types/state.js';
import { GameEvent } from '../types/events.js';
import { getCard, getCardDef, getEffectiveStrength, hasKeyword, isDefeated } from '../state/query.js';
import { addCounterToCard, gainPower } from '../state/mutate.js';
import { applyBloodshed, applyOverwhelm } from '../abilities/keywords.js';

/**
 * Resolve simultaneous fight damage between attackers and blockers.
 */
export function resolveFight(state: GameState): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  if (!s.combat) return { state: s, events };

  const { blockerAssignments, attackerIds, attackingPlayer } = s.combat;

  // Group blockers by which attacker they're blocking
  const blockersByAttacker: Record<string, string[]> = {};
  for (const [blockerId, attackerId] of Object.entries(blockerAssignments)) {
    if (!blockersByAttacker[attackerId]) {
      blockersByAttacker[attackerId] = [];
    }
    blockersByAttacker[attackerId].push(blockerId);
  }

  // For each blocked attacker, resolve simultaneous damage
  for (const [attackerId, blockerIds] of Object.entries(blockersByAttacker)) {
    const attackerCard = getCard(s, attackerId);
    if (!attackerCard || attackerCard.zone !== 'board') continue;

    const attackerStr = getEffectiveStrength(s, attackerCard);

    // Each blocker deals its strength as wounds to the attacker
    for (const blockerId of blockerIds) {
      const blockerCard = getCard(s, blockerId);
      if (!blockerCard || blockerCard.zone !== 'board') continue;

      const blockerStr = getEffectiveStrength(s, blockerCard);

      // Blocker deals damage to attacker
      if (blockerStr > 0) {
        const woundResult = addCounterToCard(s, attackerId, 'wound', blockerStr);
        s = woundResult.state;
        events.push(...woundResult.events);
      }

      // Attacker deals damage to blocker (split evenly if multiple blockers - simplified: full to each)
      if (attackerStr > 0) {
        const woundResult = addCounterToCard(s, blockerId, 'wound', attackerStr);
        s = woundResult.state;
        events.push(...woundResult.events);
      }

      // Apply bloodshed keyword (extra damage)
      const refreshedAttacker = getCard(s, attackerId);
      const refreshedBlocker = getCard(s, blockerId);
      if (refreshedAttacker && refreshedBlocker) {
        const bsResult = applyBloodshed(s, refreshedAttacker, refreshedBlocker);
        s = bsResult.state;
        events.push(...bsResult.events);
      }

      // Check if blocker was defeated for Overwhelm
      const blockerAfter = getCard(s, blockerId);
      if (blockerAfter && isDefeated(blockerAfter)) {
        const attackerStill = getCard(s, attackerId);
        if (attackerStill) {
          const owResult = applyOverwhelm(s, attackerStill, attackingPlayer);
          s = owResult.state;
          events.push(...owResult.events);
        }
      }
    }
  }

  s = { ...s, combat: { ...s.combat!, damageDealt: true } };

  return { state: s, events };
}

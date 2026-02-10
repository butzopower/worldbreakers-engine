import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { getCard, getCardDef, getEffectiveStrength, hasKeyword, isDefeated } from '../state/query';
import { addCounterToCard, gainPower } from '../state/mutate';
import { applyBloodshed, applyOverwhelm } from '../abilities/keywords';

/**
 * Resolve fight damage between a single attacker and a single blocker.
 */
export function resolveSingleFight(
  state: GameState,
  attackerId: string,
  blockerId: string,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  if (!s.combat) return { state: s, events };

  const { attackingPlayer } = s.combat;

  const attackerCard = getCard(s, attackerId);
  if (!attackerCard || attackerCard.zone !== 'board') return { state: s, events };

  const blockerCard = getCard(s, blockerId);
  if (!blockerCard || blockerCard.zone !== 'board') return { state: s, events };

  const attackerStr = getEffectiveStrength(s, attackerCard);
  const blockerStr = getEffectiveStrength(s, blockerCard);

  // Blocker deals damage to attacker
  if (blockerStr > 0) {
    const woundResult = addCounterToCard(s, attackerId, 'wound', blockerStr);
    s = woundResult.state;
    events.push(...woundResult.events);
  }

  // Attacker deals damage to blocker
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

  s = { ...s, combat: { ...s.combat!, damageDealt: true } };

  return { state: s, events };
}

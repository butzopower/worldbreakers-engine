import { PlayerId, opponentOf } from '../types/core';
import { GameState, CombatState } from '../types/state';
import { GameEvent } from '../types/events';
import { exhaustCard, gainPower } from '../state/mutate';
import { getCard, getCardDef, getLocations, isHidden, getEffectiveStrength, getFollowers, canBlock } from '../state/query';
import { resolveTriggeredAbilities } from '../abilities/triggers';
import { resolveSingleFight } from './damage';
import { runCleanup, expireLastingEffects } from '../engine/cleanup';

/**
 * Initiate combat: exhaust attackers, create combat state, trigger abilities.
 */
export function initiateAttack(
  state: GameState,
  player: PlayerId,
  attackerIds: string[],
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  // Exhaust all attackers
  for (const id of attackerIds) {
    const result = exhaustCard(s, id);
    s = result.state;
    events.push(...result.events);
  }

  // Create combat state
  const combat: CombatState = {
    step: 'declare_blockers',
    attackingPlayer: player,
    attackerIds,
    damageDealt: false,
  };

  s = { ...s, combat };
  events.push({ type: 'combat_started', attackingPlayer: player, attackerIds });

  // Trigger "Your Attack:" abilities for the attacker
  const attackTriggerResult = resolveTriggeredAbilities(s, 'your_attack', player, { attackerIds });
  s = attackTriggerResult.state;
  events.push(...attackTriggerResult.events);

  // Trigger "Attacks:" abilities on individual attackers
  for (const id of attackerIds) {
    const card = getCard(s, id);
    if (!card) continue;
    const def = getCardDef(card);
    if (def.abilities) {
      for (let i = 0; i < def.abilities.length; i++) {
        if (def.abilities[i].timing === 'attacks') {
          const triggerResult = resolveTriggeredAbilities(s, 'attacks', player, { triggeringCardId: id });
          s = triggerResult.state;
          events.push(...triggerResult.events);
        }
      }
    }
  }

  // Defender now needs to choose blockers
  const defender = opponentOf(player);
  s = {
    ...s,
    pendingChoice: {
      type: 'choose_blockers',
      playerId: defender,
      attackerIds,
    },
  };

  return { state: s, events };
}

/**
 * Declare a single blocker: resolve fight between that pair, then check if more blocking is possible.
 */
export function declareBlocker(
  state: GameState,
  blockerId: string,
  attackerId: string,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  if (!s.combat) return { state: s, events };

  const defender = opponentOf(s.combat.attackingPlayer);

  // Exhaust the blocker
  const exhaustResult = exhaustCard(s, blockerId);
  s = exhaustResult.state;
  events.push(...exhaustResult.events);

  events.push({ type: 'blocker_declared', defendingPlayer: defender, blockerId, attackerId });

  // Resolve fight between this pair
  const fightResult = resolveSingleFight(s, attackerId, blockerId);
  s = fightResult.state;
  events.push(...fightResult.events);
  events.push({ type: 'fight_resolved' });

  // Cleanup after fight (defeated cards go to discard)
  const cleanupResult = runCleanup(s);
  s = cleanupResult.state;
  events.push(...cleanupResult.events);

  if (!s.combat) return { state: s, events };

  // Remove this attacker from attackerIds (it was blocked, regardless of survival)
  const remainingAttackerIds = s.combat.attackerIds.filter(id => id !== attackerId);
  s = {
    ...s,
    combat: { ...s.combat, attackerIds: remainingAttackerIds, damageDealt: true },
    pendingChoice: null,
  };

  // Check if defender can block again
  const defenderFollowers = getFollowers(s, defender).filter(f => canBlock(s, f));
  if (defenderFollowers.length > 0 && remainingAttackerIds.length > 0) {
    // More blocking possible
    s = {
      ...s,
      pendingChoice: {
        type: 'choose_blockers',
        playerId: defender,
        attackerIds: remainingAttackerIds,
      },
    };
    return { state: s, events };
  }

  // No more blocking possible — proceed to breach with remaining attackers
  return proceedToBreach(s, events, remainingAttackerIds);
}

/**
 * Pass on blocking — skip straight to breach with all remaining attackers.
 */
export function passBlock(state: GameState): { state: GameState; events: GameEvent[] } {
  if (!state.combat) return { state, events: [] };

  const s = { ...state, pendingChoice: null as typeof state.pendingChoice };
  return proceedToBreach(s, [], state.combat.attackerIds);
}

/**
 * Proceed to breach with remaining unblocked attackers.
 */
function proceedToBreach(
  state: GameState,
  events: GameEvent[],
  remainingAttackerIds: string[],
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const allEvents = [...events];

  if (!s.combat) return { state: s, events: allEvents };

  // Check which remaining attackers are still on the board
  const livingAttackerIds = remainingAttackerIds.filter(
    id => s.cards.some(c => c.instanceId === id && c.zone === 'board')
  );

  if (livingAttackerIds.length > 0) {
    // Proceed to breach
    s = {
      ...s,
      combat: { ...s.combat, step: 'breach' },
    };

    allEvents.push({ type: 'breach', attackingPlayer: s.combat!.attackingPlayer, attackerIds: livingAttackerIds });

    // Trigger breach abilities
    const breachTriggerResult = resolveTriggeredAbilities(s, 'breach', s.combat!.attackingPlayer, {});
    s = breachTriggerResult.state;
    allEvents.push(...breachTriggerResult.events);

    // Calculate breach power
    let breachPower = 0;
    for (const id of livingAttackerIds) {
      const card = getCard(s, id);
      if (card) {
        breachPower += getEffectiveStrength(s, card);
      }
    }

    // Gain power from breach
    if (breachPower > 0) {
      const powerResult = gainPower(s, s.combat!.attackingPlayer, breachPower);
      s = powerResult.state;
      allEvents.push(...powerResult.events);
    }

    // Check if defender has locations to damage
    const defender = opponentOf(s.combat!.attackingPlayer);
    const defenderLocations = getLocations(s, defender).filter(loc => !isHidden(loc));

    if (defenderLocations.length > 0) {
      // Attacker can optionally damage a location
      s = {
        ...s,
        pendingChoice: {
          type: 'choose_breach_target',
          playerId: s.combat!.attackingPlayer,
          validLocationIds: defenderLocations.map(l => l.instanceId),
        },
      };
      return { state: s, events: allEvents };
    }

    // No locations to damage - end combat
    return endCombat(s, allEvents);
  }

  // No living attackers - end combat
  return endCombat(s, allEvents);
}

/**
 * End combat, clean up combat state, expire combat lasting effects.
 */
export function endCombat(state: GameState, events: GameEvent[]): { state: GameState; events: GameEvent[] } {
  let s: GameState = { ...state, combat: null, pendingChoice: null };
  const allEvents = [...events];

  // Expire end-of-combat lasting effects
  const expireResult = expireLastingEffects(s, 'end_of_combat');
  s = expireResult.state;
  allEvents.push(...expireResult.events);

  allEvents.push({ type: 'combat_ended' });

  return { state: s, events: allEvents };
}

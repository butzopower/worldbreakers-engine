import { PlayerId, opponentOf } from '../types/core';
import { GameState, CombatState } from '../types/state';
import { GameEvent } from '../types/events';
import { exhaustCard, gainPower } from '../state/mutate';
import { getCard, getCardDef, getLocations, isHidden, getEffectiveStrength, getFollowers, canBlock, canBlockAttacker, hasKeyword } from '../state/query';
import { resolveTriggeredAbilities } from '../abilities/triggers';
import { resolveAbility } from '../abilities/resolver';
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

  // Create combat state in resolve_attack_abilities step
  const combat: CombatState = {
    step: 'resolve_attack_abilities',
    attackingPlayer: player,
    attackerIds,
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

  // Transition to declare_blockers (unless a trigger created a pending choice)
  const defender = opponentOf(player);
  if (!s.pendingChoice) {
    s = {
      ...s,
      combat: { ...s.combat!, step: 'declare_blockers' },
      pendingChoice: {
        type: 'choose_blockers',
        playerId: defender,
        attackerIds,
      },
    };
  }
  // If a trigger created a pending choice, stay in resolve_attack_abilities.
  // handlePendingChoice will transition to declare_blockers after resolution.

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
    combat: { ...s.combat, attackerIds: remainingAttackerIds },
    pendingChoice: null,
  };

  // Fire 'overwhelms' trigger if the blocker was defeated by an attacker with overwhelm.
  // Only fires for the specific attacker that overwhelmed (not all board cards).
  const blockerAfterCleanup = getCard(s, blockerId);
  const attackerAfterCleanup = getCard(s, attackerId);
  const blockerDefeated = !blockerAfterCleanup || blockerAfterCleanup.zone !== 'board';
  if (blockerDefeated && attackerAfterCleanup) {
    const attackerDef = getCardDef(attackerAfterCleanup);
    if (hasKeyword(s, attackerAfterCleanup, 'overwhelm') && attackerDef.abilities) {
      for (let i = 0; i < attackerDef.abilities.length; i++) {
        if (attackerDef.abilities[i].timing === 'overwhelms') {
          events.push({ type: 'ability_triggered', cardInstanceId: attackerId, abilityIndex: i, timing: 'overwhelms' });
          const overwhelmResult = resolveAbility(s, s.combat!.attackingPlayer, attackerId, attackerDef.abilities[i], i);
          s = overwhelmResult.state;
          events.push(...overwhelmResult.events);
        }
      }
    }
  }

  // If a trigger created a pending choice, return early.
  // Engine's handlePendingChoice will call resumePostBlock after the choice resolves.
  if (s.pendingChoice) {
    return { state: s, events };
  }

  return resumePostBlock(s, events, remainingAttackerIds);
}

/**
 * Resume the blocking flow after a pending choice (e.g. an overwhelms trigger) has resolved.
 * Sets up choose_blockers if attackers remain and blockers are available, otherwise proceeds to breach.
 */
export function resumePostBlock(
  state: GameState,
  events: GameEvent[],
  remainingAttackerIds: string[],
): { state: GameState; events: GameEvent[] } {
  if (!state.combat) return { state, events };

  if (remainingAttackerIds.length > 0) {
    const defender = opponentOf(state.combat.attackingPlayer);
    const availableBlockers = getFollowers(state, defender).filter(f => canBlock(state, f));
    // Check if any blocker can actually block any remaining attacker
    const hasValidPair = availableBlockers.some(blocker =>
      remainingAttackerIds.some(atkId => canBlockAttacker(state, blocker, atkId))
    );
    if (hasValidPair) {
      const s = {
        ...state,
        pendingChoice: {
          type: 'choose_blockers' as const,
          playerId: defender,
          attackerIds: remainingAttackerIds,
        },
      };
      return { state: s, events };
    }
  }

  return proceedToBreach(state, events, remainingAttackerIds);
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

    // If a breach ability created a pending choice (e.g. discard), pause here.
    // The remaining breach work will be completed via resumeBreach after the choice resolves.
    if (s.pendingChoice) {
      return { state: s, events: allEvents };
    }

    // Complete remaining breach work (power gain + location damage)
    return completeBreachFlow(s, allEvents);
  }

  // No living attackers - end combat
  return endCombat(s, allEvents);
}

/**
 * Complete the remaining breach flow: calculate and grant breach power,
 * then check for defender locations or end combat.
 */
function completeBreachFlow(
  state: GameState,
  events: GameEvent[],
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const allEvents = [...events];

  if (!s.combat) return { state: s, events: allEvents };

  // Get living attackers
  const livingAttackerIds = s.combat.attackerIds.filter(
    id => s.cards.some(c => c.instanceId === id && c.zone === 'board')
  );

  // Calculate breach power
  let breachPower = 0;
  for (const id of livingAttackerIds) {
    const card = getCard(s, id);
    if (card) {
      breachPower++;
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
  const defenderLocations = getLocations(s, defender).filter(loc => !isHidden(s, loc));

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

/**
 * Resume breach flow after a pending choice (e.g. discard) has been resolved.
 * Completes the remaining breach work: power gain + location damage choice.
 */
export function resumeBreach(state: GameState): { state: GameState; events: GameEvent[] } {
  return completeBreachFlow(state, []);
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

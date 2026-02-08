import { PlayerId, opponentOf } from '../types/core.js';
import { GameState, CombatState } from '../types/state.js';
import { GameEvent } from '../types/events.js';
import { exhaustCard, gainPower } from '../state/mutate.js';
import { getCard, getCardDef, getLocations, isHidden, getEffectiveStrength } from '../state/query.js';
import { resolveTriggeredAbilities } from '../abilities/triggers.js';
import { resolveFight } from './damage.js';
import { runCleanup, expireLastingEffects } from '../engine/cleanup.js';

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
    blockerAssignments: {},
    blockedAttackerIds: [],
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
      context: { attackerIds },
    },
  };

  return { state: s, events };
}

/**
 * Process blocker declarations, then proceed to fight.
 */
export function declareBlockers(
  state: GameState,
  assignments: Record<string, string>,
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  if (!s.combat) return { state: s, events };

  const blockedAttackerIds = [...new Set(Object.values(assignments))];

  s = {
    ...s,
    combat: {
      ...s.combat,
      step: 'fight',
      blockerAssignments: assignments,
      blockedAttackerIds,
    },
    pendingChoice: null,
  };

  const defender = opponentOf(s.combat!.attackingPlayer);
  events.push({ type: 'blockers_declared', defendingPlayer: defender, assignments });

  // Now resolve fight
  return proceedToFight(s, events);
}

/**
 * Pass on blocking - no blockers declared.
 */
export function passBlock(state: GameState): { state: GameState; events: GameEvent[] } {
  return declareBlockers(state, {});
}

/**
 * Resolve fight step and proceed to breach.
 */
function proceedToFight(state: GameState, events: GameEvent[]): { state: GameState; events: GameEvent[] } {
  let s = state;
  const allEvents = [...events];

  if (!s.combat) return { state: s, events: allEvents };

  // Resolve simultaneous fight damage
  const fightResult = resolveFight(s);
  s = fightResult.state;
  allEvents.push(...fightResult.events);
  allEvents.push({ type: 'fight_resolved' });

  // Cleanup after fight
  const cleanupResult = runCleanup(s);
  s = cleanupResult.state;
  allEvents.push(...cleanupResult.events);

  // Determine unblocked attackers for breach
  if (!s.combat) return { state: s, events: allEvents };

  const unblockedAttackerIds = s.combat.attackerIds.filter(
    id => !s.combat!.blockedAttackerIds.includes(id)
  );

  // Check which unblocked attackers are still on the board
  const livingUnblockedIds = unblockedAttackerIds.filter(
    id => s.cards.some(c => c.instanceId === id && c.zone === 'board')
  );

  if (livingUnblockedIds.length > 0) {
    // Proceed to breach
    s = {
      ...s,
      combat: { ...s.combat!, step: 'breach' },
    };

    allEvents.push({ type: 'breach', attackingPlayer: s.combat!.attackingPlayer, attackerIds: livingUnblockedIds });

    // Trigger breach abilities
    const breachTriggerResult = resolveTriggeredAbilities(s, 'breach', s.combat!.attackingPlayer, {});
    s = breachTriggerResult.state;
    allEvents.push(...breachTriggerResult.events);

    // Calculate breach power
    let breachPower = 0;
    for (const id of livingUnblockedIds) {
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
          context: {
            validLocationIds: defenderLocations.map(l => l.instanceId),
          },
        },
      };
      return { state: s, events: allEvents };
    }

    // No locations to damage - end combat
    return endCombat(s, allEvents);
  }

  // No unblocked attackers - end combat
  return endCombat(s, allEvents);
}

/**
 * End combat, clean up combat state, expire combat lasting effects.
 */
export function endCombat(state: GameState, events: GameEvent[]): { state: GameState; events: GameEvent[] } {
  let s = { ...state, combat: null, pendingChoice: null };
  const allEvents = [...events];

  // Expire end-of-combat lasting effects
  const expireResult = expireLastingEffects(s, 'end_of_combat');
  s = expireResult.state;
  allEvents.push(...expireResult.events);

  allEvents.push({ type: 'combat_ended' });

  return { state: s, events: allEvents };
}

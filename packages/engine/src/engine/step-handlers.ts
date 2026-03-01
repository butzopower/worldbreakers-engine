import { CombatResponseTrigger, GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { EngineStep } from '../types/steps';
import { PlayerId, PLAYERS, opponentOf } from '../types/core';
import { runCleanup, expireLastingEffects } from './cleanup';
import {
  drawCard,
  exhaustCard,
  gainMythium,
  gainPower,
  gainStanding, moveCard,
  readyCard,
  removeCounterFromCard,
  setPendingChoice, shuffleDeck
} from '../state/mutate';
import { getBoard, getCardDef, getWorldbreaker, isDefeated } from '../state/query';
import { getCounter } from '../types/counters';
import { ResolveContext, findValidTargets, resolvePrimitive } from '../abilities/primitives';
import { getCustomResolver } from '../abilities/system';
import { getCard } from '../state/query';
import { getFollowers, getLocations, isHidden, canAttack, canBlock, canBlockAttacker, hasKeyword } from '../state/query';
import { AbilityDefinition, EffectPrimitive, Mode } from '../types/effects';
import { handleDevelop } from "../actions/develop";
import { resolveSingleFight } from '../combat/damage';

export interface StepResult {
  state: GameState;
  events: GameEvent[];
  prepend?: EngineStep[];
}

const ACTIONS_PER_ROUND = 8;

/**
 * Process a single engine step and return the result.
 */
export function executeStep(state: GameState, step: EngineStep): StepResult {
  switch (step.type) {
    case 'request_choose_mode':
      return handleRequestChooseMode(state, step.player, step.sourceCardId, step.modes)
    case 'request_choose_discard':
      return handleRequestChooseDiscard(state, step.player, step.sourceCardId, step.count)
    case 'request_choose_attackers':
      return handleRequestChooseAttackers(state, step.player)
    case 'cleanup':
      return handleCleanup(state);
    case 'advance_turn':
      return handleAdvanceTurn(state);
    case 'rally_triggers':
      return handleRallyTriggers(state, step.player);
    case 'rally_ready':
      return handleRallyReady(state, step.player);
    case 'rally_mythium':
      return handleRallyMythium(state, step.player);
    case 'rally_draw':
      return handleRallyDraw(state, step.player);
    case 'rally_victory_check':
      return handleRallyVictoryCheck(state);
    case 'rally_new_round':
      return handleRallyNewRound(state);
    case 'resolve_effects':
      return handleResolveEffects(state, step.effects, step.ctx);
    case 'resolve_ability_at_index':
      return handleResolveAbilityAtIndex(state, step.controller, step.sourceCardId, step.abilityIndex, step.triggeringCardId);
    case 'resolve_ability':
      return handleResolveAbility(state, step.controller, step.sourceCardId, step.ability, step.triggeringCardId);
    case 'resolve_custom_ability':
      return handleResolveCustomAbility(state, step.controller, step.sourceCardId, step.customResolve, step.triggeringCardId);
    case 'check_triggers':
      return handleCheckTriggers(state, step.timing, step.player, step.triggeringCardId);
    case 'check_combat_responses':
      return handleCheckCombatResponses(state, step.timing);
    case 'combat_declare_blockers':
      return handleCombatDeclareBlockers(state, step.defender, step.attackerIds);
    case 'combat_fight':
      return handleCombatFight(state, step.attackerId, step.blockerId);
    case 'check_overwhelm_trigger':
      return handleCombatCheckOverwhelm(state, step.attackerId);
    case 'combat_post_block':
      return handleCombatPostBlock(state, step.remainingAttackerIds);
    case 'combat_breach':
      return handleCombatBreach(state, step.livingAttackerIds);
    case 'combat_breach_complete':
      return handleCombatBreachComplete(state);
    case 'choose_breach_target':
      return handleChooseBreachTarget(state, step.player);
    case 'combat_end':
      return handleCombatEnd(state);
    case 'develop':
      return handleDevelop(state, step.player, step.locationId);
    case 'reveal_cards':
      return revealCards(state, step.player, step.cardDefinitionIds);
    case 'move_card':
      return moveCard(state, step.cardInstanceId, step.toZone)
    case 'shuffle_deck':
      return shuffleDeck(state, step.player);
    case 'gain_mythium':
      return gainMythium(state, step.player, step.amount);
    case 'gain_power':
      return gainPower(state, step.player, step.amount);
    case 'gain_standing':
      return gainStanding(state, step.player, step.guild, step.amount);
  }
}

/**
 * Drain the step queue: process steps sequentially until the queue is empty
 * or a pendingChoice pauses execution.
 */
export function drainQueue(
  state: GameState,
  events: GameEvent[],
): { state: GameState; events: GameEvent[] } {
  let s = state;
  let allEvents = [...events];

  while (s.stepQueue && s.stepQueue.length > 0) {
    const [step, ...remaining] = s.stepQueue;
    s = { ...s, stepQueue: remaining };

    const result = executeStep(s, step);
    s = result.state;
    allEvents.push(...result.events);

    // If a pendingChoice was set, save remaining steps + prepended steps and pause
    if (s.pendingChoice) {
      const newQueue = [...(result.prepend ?? []), ...(s.stepQueue ?? [])];
      s = { ...s, stepQueue: newQueue.length > 0 ? newQueue : null };
      return { state: s, events: allEvents };
    }

    // Prepend any new steps
    if (result.prepend && result.prepend.length > 0) {
      s = { ...s, stepQueue: [...result.prepend, ...(s.stepQueue ?? [])] };
    }
  }

  // Queue fully drained
  s = { ...s, stepQueue: null };
  return { state: s, events: allEvents };
}

// --- Step Handlers ---

function handleRequestChooseMode(state: GameState, player: PlayerId, sourceCardId: string, modes: Mode[]): StepResult {
  return setPendingChoice(state, {
    type: 'choose_mode',
    playerId: player,
    sourceCardId: sourceCardId,
    modes,
  });
}

function handleRequestChooseDiscard(state: GameState, player: PlayerId, sourceCardId: string, count: number): StepResult {
  return setPendingChoice(state, {
    type: 'choose_discard',
    playerId: player,
    sourceCardId: sourceCardId,
    count,
  });
}

function handleRequestChooseAttackers(state: GameState, player: PlayerId): StepResult {
  const attackable = getFollowers(state, player).filter(f => canAttack(state, f));
  if (attackable.length === 0) return { state, events: [] };
  return setPendingChoice(state, {
    type: 'choose_attackers',
    playerId: player,
  });
}

function handleCleanup(state: GameState): StepResult {
  const result = runCleanup(state);
  // Check for defeated/depleted events and queue trigger checks
  const prepend: EngineStep[] = [];
  const defeatedEvents = result.events.filter(e => e.type === 'card_defeated');
  const depletedEvents = result.events.filter(e => e.type === 'location_depleted');

  for (const e of defeatedEvents) {
    for (const p of PLAYERS) {
      prepend.push({ type: 'check_triggers', timing: 'follower_defeated', player: p, triggeringCardId: e.cardInstanceId });
    }
  }
  for (const e of depletedEvents) {
    for (const p of PLAYERS) {
      prepend.push({ type: 'check_triggers', timing: 'location_depleted', player: p, triggeringCardId: e.locationInstanceId });
    }
  }

  // If there were defeat/deplete triggers, run another cleanup after them
  if (prepend.length > 0) {
    prepend.push({ type: 'cleanup' });
  }

  return { state: result.state, events: result.events, prepend };
}

function handleAdvanceTurn(state: GameState): StepResult {
  let s = { ...state, actionsTaken: state.actionsTaken + 1 };
  const events: GameEvent[] = [];

  if (s.actionsTaken >= ACTIONS_PER_ROUND) {
    // Queue rally phase steps
    s = { ...s, phase: 'rally' };
    events.push({ type: 'phase_changed', phase: 'rally', round: s.round });

    const rallySteps: EngineStep[] = [
      ...PLAYERS.map(p => ({ type: 'rally_triggers' as const, player: p })),
      ...PLAYERS.map(p => ({ type: 'rally_ready' as const, player: p })),
      ...PLAYERS.map(p => ({ type: 'rally_mythium' as const, player: p })),
      ...PLAYERS.map(p => ({ type: 'rally_draw' as const, player: p })),
      { type: 'rally_victory_check' },
      { type: 'rally_new_round' },
    ];

    return { state: s, events, prepend: rallySteps };
  }

  // Alternate active player
  const nextPlayer = s.activePlayer === s.firstPlayer
    ? opponentOf(s.firstPlayer)
    : s.firstPlayer;

  s = { ...s, activePlayer: nextPlayer };
  events.push({ type: 'turn_changed', activePlayer: nextPlayer });

  // Expire end-of-turn lasting effects
  const expireResult = expireLastingEffects(s, 'end_of_turn');
  s = expireResult.state;
  events.push(...expireResult.events);

  return { state: s, events };
}

function handleRallyTriggers(state: GameState, player: PlayerId): StepResult {
  const events: GameEvent[] = [
    { type: 'rally_step', step: 'rally_abilities', player },
  ];

  // Scan for rally abilities and prepend resolve steps
  const prepend: EngineStep[] = [];

  const wb = getWorldbreaker(state, player);
  if (wb) {
    const wbDef = getCardDef(wb);
    if (wbDef.abilities) {
      for (let i = 0; i < wbDef.abilities.length; i++) {
        if (wbDef.abilities[i].timing === 'rally') {
          prepend.push({ type: 'resolve_ability_at_index', controller: player, sourceCardId: wb.instanceId, abilityIndex: i });
        }
      }
    }
  }

  const board = getBoard(state, player);
  for (const card of board) {
    const def = getCardDef(card);
    if (!def.abilities) continue;
    for (let i = 0; i < def.abilities.length; i++) {
      if (def.abilities[i].timing === 'rally') {
        prepend.push({ type: 'resolve_ability_at_index', controller: player, sourceCardId: card.instanceId, abilityIndex: i });
      }
    }
  }

  // Add cleanup after rally triggers if any were found
  if (prepend.length > 0) {
    prepend.push({ type: 'cleanup' });
  }

  return { state, events, prepend };
}

function handleRallyReady(state: GameState, player: PlayerId): StepResult {
  let s = state;
  const events: GameEvent[] = [
    { type: 'rally_step', step: 'ready_all', player },
  ];

  const board = getBoard(s, player);
  for (const card of board) {
    const stunCount = getCounter(card.counters, 'stun');
    if (stunCount > 0) {
      const removeResult = removeCounterFromCard(s, card.instanceId, 'stun', 1);
      s = removeResult.state;
      events.push(...removeResult.events);
    } else if (card.exhausted) {
      const readyResult = readyCard(s, card.instanceId);
      s = readyResult.state;
      events.push(...readyResult.events);
    }
  }

  return { state: s, events };
}

function handleRallyMythium(state: GameState, player: PlayerId): StepResult {
  return { state, events: [], prepend: [{type: 'gain_mythium', player, amount: 2}] };
}

function handleRallyDraw(state: GameState, player: PlayerId): StepResult {
  const events: GameEvent[] = [
    { type: 'rally_step', step: 'draw_card', player },
  ];
  const hasDeck = state.cards.some(c => c.owner === player && c.zone === 'deck');
  if (hasDeck) {
    const drawResult = drawCard(state, player);
    events.push(...drawResult.events);
    return { state: drawResult.state, events };
  }
  const opponent = opponentOf(player);
  const powerResult = gainPower(state, opponent, 1);
  events.push(...powerResult.events);
  return { state: powerResult.state, events };
}

function handleRallyVictoryCheck(state: GameState): StepResult {
  const p1Power = state.players.player1.power;
  const p2Power = state.players.player2.power;
  const events: GameEvent[] = [];

  if (p1Power >= 10 || p2Power >= 10) {
    let s = state;
    if (p1Power >= 10 && p2Power >= 10) {
      if (p1Power > p2Power) {
        s = { ...s, phase: 'gameOver', winner: 'player1' };
      } else if (p2Power > p1Power) {
        s = { ...s, phase: 'gameOver', winner: 'player2' };
      } else {
        s = { ...s, phase: 'gameOver', winner: 'draw' };
      }
    } else if (p1Power >= 10) {
      s = { ...s, phase: 'gameOver', winner: 'player1' };
    } else {
      s = { ...s, phase: 'gameOver', winner: 'player2' };
    }
    events.push({ type: 'game_over', winner: s.winner! });
    // Clear remaining queue — game is over
    s = { ...s, stepQueue: null };
    return { state: s, events };
  }

  return { state, events };
}

function handleRallyNewRound(state: GameState): StepResult {
  const events: GameEvent[] = [];
  const newFirstPlayer = opponentOf(state.firstPlayer);
  let s: GameState = {
    ...state,
    phase: 'action',
    round: state.round + 1,
    actionsTaken: 0,
    firstPlayer: newFirstPlayer,
    activePlayer: newFirstPlayer,
  };

  // Expire end-of-round lasting effects
  const expireResult = expireLastingEffects(s, 'end_of_round');
  s = expireResult.state;
  events.push(...expireResult.events);

  events.push({ type: 'phase_changed', phase: 'action', round: s.round });
  events.push({ type: 'turn_changed', activePlayer: s.activePlayer });

  return { state: s, events };
}

// --- Effect/Ability Resolution Steps ---

function handleResolveEffects(state: GameState, effects: EffectPrimitive[], ctx: ResolveContext): StepResult {
  const result = resolveEffectsWithQueue(state, effects, ctx);
  return { state: result.state, events: result.events, prepend: result.prepend };
}

function handleResolveAbilityAtIndex(state: GameState, controller: PlayerId, sourceCardId: string, abilityIndex: number, triggeringCardId?: string): StepResult {
  const card = getCard(state, sourceCardId);
  if (!card) return { state, events: [] };
  const def = getCardDef(card);
  if (!def.abilities || !def.abilities[abilityIndex]) return { state, events: [] };

  const ability = def.abilities[abilityIndex];
  const prepend: EngineStep[] = [
    {
      type: 'resolve_ability',
      controller,
      sourceCardId,
      triggeringCardId,
      ability
    }
  ]
  return { state, events: [], prepend}
}

function handleResolveAbility(state: GameState, controller: PlayerId, sourceCardId: string, ability: AbilityDefinition, triggeringCardId?: string) {
  const events: GameEvent[] = [
    { type: 'ability_triggered', cardInstanceId: sourceCardId, timing: ability.timing },
  ];

  if (ability.customResolve) {
    const prepend: EngineStep[] = [
      {
        type: 'resolve_custom_ability',
        controller,
        sourceCardId,
        customResolve: ability.customResolve,
        triggeringCardId,
      }
    ]
    return { state, events, prepend };
  }

  if (!ability.effects || ability.effects.length === 0) {
    return { state, events };
  }

  const ctx: ResolveContext = { controller, sourceCardId, triggeringCardId };
  const result = resolveEffectsWithQueue(state, ability.effects, ctx);
  events.push(...result.events);
  return { state: result.state, events, prepend: result.prepend };
}

function handleResolveCustomAbility(state: GameState, controller: PlayerId, sourceCardId: string, customResolve: string, triggeringCardId?: string): StepResult {
  const card = getCard(state, sourceCardId);
  const events: GameEvent[] = [];

  // Find the ability index for the event
  if (card) {
    const def = getCardDef(card);
    if (def.abilities) {
      for (let i = 0; i < def.abilities.length; i++) {
        if (def.abilities[i].customResolve === customResolve) {
          events.push({ type: 'ability_triggered', cardInstanceId: sourceCardId, abilityIndex: i, timing: def.abilities[i].timing });
          break;
        }
      }
    }
  }

  const customFn = getCustomResolver(customResolve);
  if (customFn) {
    const ctx: ResolveContext = { controller, sourceCardId, triggeringCardId };
    return { state, events, prepend: customFn(state, ctx) };
  }
  return { state, events };
}

function handleCheckTriggers(state: GameState, timing: import('../types/effects').AbilityTiming, player: PlayerId, triggeringCardId?: string): StepResult {
  const prepend: EngineStep[] = [];

  // Scan worldbreaker
  const wb = getWorldbreaker(state, player);
  if (wb) {
    const wbDef = getCardDef(wb);
    if (wbDef.abilities) {
      for (let i = 0; i < wbDef.abilities.length; i++) {
        if (wbDef.abilities[i].timing === timing) {
          prepend.push({ type: 'resolve_ability_at_index', controller: player, sourceCardId: wb.instanceId, abilityIndex: i, triggeringCardId });
        }
      }
    }
  }

  // Scan board cards
  const board = getBoard(state, player);
  for (const card of board) {
    const def = getCardDef(card);
    if (!def.abilities) continue;
    for (let i = 0; i < def.abilities.length; i++) {
      if (def.abilities[i].timing === timing) {
        prepend.push({ type: 'resolve_ability_at_index', controller: player, sourceCardId: card.instanceId, abilityIndex: i, triggeringCardId });
      }
    }
  }

  return { state, events: [], prepend };
}

function handleCheckCombatResponses(state: GameState, timing: CombatResponseTrigger): StepResult {
  const prepend: EngineStep[] = [];
  const events: GameEvent[] = [];
  let s = state;

  const matching = state.combatResponses.filter(r => r.trigger === timing);
  if (matching.length > 0) {
    s = { ...state, combatResponses: state.combatResponses.filter(r => r.trigger !== timing) };
    for (const response of matching) {
      const result = resolveEffectsWithQueue(s, response.effects, {
        controller: response.controller,
        sourceCardId: response.sourceCardId,
      });
      s = result.state;
      events.push(...result.events);
      prepend.push(...(result.prepend ?? []));
    }
  }

  return { state: s, events, prepend };
}

// --- Combat Step Handlers ---

function handleCombatDeclareBlockers(state: GameState, defender: PlayerId, attackerIds: string[]): StepResult {
  const s: GameState = {
    ...state,
    combat: state.combat ? { ...state.combat, step: 'declare_blockers' } : null,
    pendingChoice: {
      type: 'choose_blockers',
      playerId: defender,
      attackerIds,
    },
  };
  return { state: s, events: [] };
}

function handleCombatFight(state: GameState, attackerId: string, blockerId: string): StepResult {
  if (!state.combat) return { state, events: [] };

  let s = state;
  const events: GameEvent[] = [];
  const prepend: EngineStep[] = [];

  const defender = opponentOf(state.combat.attackingPlayer);

  const exhaustResult = exhaustCard(s, blockerId);
  s = exhaustResult.state;
  events.push(...exhaustResult.events);
  events.push({ type: 'blocker_declared', defendingPlayer: defender, blockerId, attackerId });

  const fightResult = resolveSingleFight(s, attackerId, blockerId);
  s = fightResult.state;
  events.push(...fightResult.events);
  events.push({ type: 'fight_resolved' });

  if (fightResult.events.some(e => e.type === 'power_gained')) {
    prepend.push({ type: 'check_combat_responses', timing: 'on_power_gain' });
  }

  const postBlockBlocker = getCard(s, blockerId);
  const blockerDefeated = !!postBlockBlocker && isDefeated(postBlockBlocker);

  const remainingAttackerIds = s.combat!.attackerIds.filter(id => id !== attackerId);
  s = { ...s, combat: { ...state.combat, attackerIds: remainingAttackerIds } };

  prepend.push({ type: 'cleanup' });

  if (blockerDefeated) {
    prepend.push({ type: 'check_overwhelm_trigger', attackerId });
  }

  prepend.push({ type: 'combat_post_block', remainingAttackerIds });

  return { state: s, events, prepend };
}

function handleCombatCheckOverwhelm(state: GameState, attackerId: string): StepResult {
  if (!state.combat) return { state, events: [] };

  const prepend: EngineStep[] = [];

  const attackerCard = getCard(state, attackerId);

  if (attackerCard) {
    const attackerDef = getCardDef(attackerCard);
    if (hasKeyword(state, attackerCard, 'overwhelm') && attackerDef.abilities) {
      for (let i = 0; i < attackerDef.abilities.length; i++) {
        if (attackerDef.abilities[i].timing === 'overwhelms') {
          prepend.push({
            type: 'resolve_ability_at_index',
            controller: state.combat.attackingPlayer,
            sourceCardId: attackerId,
            abilityIndex: i,
          });
        }
      }
    }
  }

  if (prepend.length > 0) {
    prepend.push({ type: 'cleanup' });
  }

  return { state, events: [], prepend };
}

function handleCombatPostBlock(state: GameState, remainingAttackerIds: string[]): StepResult {
  if (!state.combat) return { state, events: [] };

  if (remainingAttackerIds.length > 0) {
    const defender = opponentOf(state.combat.attackingPlayer);
    const availableBlockers = getFollowers(state, defender).filter(f => canBlock(state, f));
    const hasValidPair = availableBlockers.some(blocker =>
      remainingAttackerIds.some(atkId => canBlockAttacker(state, blocker, atkId))
    );
    if (hasValidPair) {
      // More blocking possible — create pending choice, queue stays paused
      const s: GameState = {
        ...state,
        combat: { ...state.combat, attackerIds: remainingAttackerIds },
        pendingChoice: {
          type: 'choose_blockers',
          playerId: defender,
          attackerIds: remainingAttackerIds,
        },
      };
      return { state: s, events: [] };
    }
  }

  // No more blocking — proceed to breach
  const livingAttackerIds = remainingAttackerIds.filter(
    id => state.cards.some(c => c.instanceId === id && c.zone === 'board')
  );

  if (livingAttackerIds.length > 0) {
    return {
      state,
      events: [],
      prepend: [{ type: 'combat_breach', livingAttackerIds }],
    };
  }

  // No living attackers — end combat
  return { state, events: [], prepend: [{ type: 'combat_end' }] };
}

function handleCombatBreach(state: GameState, livingAttackerIds: string[]): StepResult {
  if (!state.combat) return { state, events: [] };

  let s: GameState = {
    ...state,
    combat: { ...state.combat, step: 'breach' },
  };
  const events: GameEvent[] = [
    { type: 'breach', attackingPlayer: s.combat!.attackingPlayer, attackerIds: livingAttackerIds },
  ];

  // Queue breach triggers, then complete breach
  const prepend: EngineStep[] = [
    { type: 'check_triggers', timing: 'breach', player: s.combat!.attackingPlayer },
    { type: 'cleanup' },
    { type: 'combat_breach_complete' },
  ];

  return { state: s, events, prepend };
}

function handleCombatBreachComplete(state: GameState): StepResult {
  if (!state.combat) return { state, events: [] };

  const attackingPlayer = state.combat.attackingPlayer;

  let s = state;
  const events: GameEvent[] = [];

  // Get living attackers
  const livingAttackerIds = state.combat.attackerIds.filter(
    id => s.cards.some(c => c.instanceId === id && c.zone === 'board')
  );

  // Calculate breach power
  let breachPower = 0;
  for (const id of livingAttackerIds) {
    const card = getCard(s, id);
    if (card) breachPower++;
  }

  const prepend: EngineStep[] = [];

  // Gain power from breach
  if (breachPower > 0) {
    // Fire combat responses triggered by successful breach
    prepend.push(
      { type: 'gain_power', player: attackingPlayer, amount: breachPower},
      { type: 'check_combat_responses', timing: 'on_power_gain' },
      { type: 'choose_breach_target', player: attackingPlayer }
    );
  }

  // No locations — end combat via the queue
  return { state: s, events, prepend: [...prepend, { type: 'combat_end' }] };
}

function handleChooseBreachTarget(s: GameState, playerId: PlayerId): StepResult {
  if (!s.combat) return { state: s, events: [] };

  // Check if defender has locations to damage
  const defender = opponentOf(playerId);
  const defenderLocations = getLocations(s, defender).filter(loc => !isHidden(s, loc));

  if (defenderLocations.length === 0) {
    return {state: s, events: [] };
  }

  const state = {
    ...s,
    pendingChoice: {
      type: 'choose_breach_target' as const,
      playerId: s.combat.attackingPlayer,
      validLocationIds: defenderLocations.map(l => l.instanceId),
    },
  }

  return { state, events: []}
}

function handleCombatEnd(state: GameState): StepResult {
  let s: GameState = { ...state, combat: null, pendingChoice: null, combatResponses: [] };
  const events: GameEvent[] = [];

  // Expire end-of-combat lasting effects
  const expireResult = expireLastingEffects(s, 'end_of_combat');
  s = expireResult.state;
  events.push(...expireResult.events);

  events.push({ type: 'combat_ended' });

  return { state: s, events };
}

// --- Utility ---

/**
 * Resolve effects using the queue model: instead of storing remainingEffects
 * on state, return them as a prepend step.
 */
export function resolveEffectsWithQueue(
  state: GameState,
  effects: EffectPrimitive[],
  ctx: ResolveContext,
  abilityIndex = 0,
): { state: GameState; events: GameEvent[]; prepend?: EngineStep[] } {
  let s = state;
  const events: GameEvent[] = [];

  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i];

    if (effect.type === 'choose_one') {
      const remainingEffects = effects.slice(i + 1);
      const prepend: EngineStep[] = [
        {
          type: 'request_choose_mode',
          player: ctx.controller,
          sourceCardId: ctx.sourceCardId,
          modes: effect.modes,
        },
      ];
      if (remainingEffects.length > 0) {
        prepend.push({ type: 'resolve_effects', effects: remainingEffects, ctx: { controller: ctx.controller, sourceCardId: ctx.sourceCardId, triggeringCardId: ctx.triggeringCardId } });
      }
      return { state: s, events, prepend };
    }

    if (!ctx.chosenTargets && 'target' in effect && effect.target && effect.target.kind === 'choose') {
      const validTargets = findValidTargets(s, effect.target, ctx);
      if (validTargets.length === 0) continue;

      const remainingEffects = effects.slice(i + 1);
      s = {
        ...s,
        pendingChoice: {
          type: 'choose_target',
          playerId: ctx.controller,
          sourceCardId: ctx.sourceCardId,
          abilityIndex,
          effects: [effect],
          filter: effect.target.filter,
          triggeringCardId: ctx.triggeringCardId,
        },
      };
      const prepend: EngineStep[] = [];
      if (remainingEffects.length > 0) {
        prepend.push({ type: 'resolve_effects', effects: remainingEffects, ctx: { controller: ctx.controller, sourceCardId: ctx.sourceCardId, triggeringCardId: ctx.triggeringCardId } });
      }
      return { state: s, events, prepend };
    }

    const result = resolvePrimitive(s, effect, ctx);
    s = result.state;
    events.push(...result.events);
    if (s.pendingChoice || result.prepend) {
      // A primitive set a pending choice (e.g. initiate_attack)
      const remainingEffects = effects.slice(i + 1);
      const prepend: EngineStep[] = [...(result.prepend ?? [])];
      if (remainingEffects.length > 0) {
        prepend.push({ type: 'resolve_effects', effects: remainingEffects, ctx: { controller: ctx.controller, sourceCardId: ctx.sourceCardId, triggeringCardId: ctx.triggeringCardId } });
      }
      return { state: s, events, prepend };
    }
  }

  return { state: s, events };
}

function revealCards(state: GameState, player: PlayerId, cardDefinitionIds: string[]) {
  const events: GameEvent[] = [
    {
      type: 'reveal',
      player,
      cardDefinitionIds
    }
  ]
  return { state, events };
}

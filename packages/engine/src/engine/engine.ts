import { GameState, PendingChoice } from '../types/state';
import { ActionInput, PlayerAction } from '../types/actions';
import { GameEvent } from '../types/events';
import { PlayerId, STANDING_GUILDS, opponentOf } from '../types/core';
import { EngineStep } from '../types/steps';
import { validateAction } from './validator';
import { drainQueue, resolveEffectsWithQueue, StepResult } from './step-handlers';

import { ResolveContext } from '../abilities/primitives';
import { moveCard, removeCounterFromCard } from '../state/mutate';
import { getCard, getHand, getCardDef, canPay, hasKeyword, getPassiveCostReduction } from '../state/query';
import { getCounter } from '../types/counters';
import {
  canPlayCard, canAttack, canBlock, canBlockAttacker, canDevelop, canUseAbility,
  getFollowers, getLocations, getBoard,
} from '../state/query';

export interface ProcessResult {
  state: GameState;
  events: GameEvent[];
  /** If set, the engine is waiting for this player input */
  waitingFor?: PendingChoice;
}

/**
 * Main entry point: process a player action against the current state.
 */
export function processAction(state: GameState, input: ActionInput): ProcessResult {
  const validation = validateAction(state, input);
  if (!validation.valid) {
    throw new Error(`Invalid action: ${validation.reason}`);
  }

  const { player, action } = input;

  if (state.pendingChoice) {
    // Resolve choice, then resume draining the queue
    const choiceResult = resolveChoice(state, player, action);
    let s = choiceResult.state;
    let events = choiceResult.events;

    // If the choice resolution already set a new pending choice, return
    if (s.pendingChoice) {
      // Merge any prepended steps into the queue
      if (choiceResult.prepend && choiceResult.prepend.length > 0) {
        const existingQueue = s.stepQueue ?? [];
        s = { ...s, stepQueue: [...choiceResult.prepend, ...existingQueue] };
      }
      return { state: s, events, waitingFor: s.pendingChoice ?? undefined};
    }

    // Prepend any new steps from choice resolution
    if (choiceResult.prepend && choiceResult.prepend.length > 0) {
      const existingQueue = s.stepQueue ?? [];
      s = { ...s, stepQueue: [...choiceResult.prepend, ...existingQueue] };
    }

    // Resume draining
    if (s.stepQueue && s.stepQueue.length > 0) {
      const drainResult = drainQueue(s, events);
      s = drainResult.state;
      events = drainResult.events;
    } else {
      s = { ...s, stepQueue: null };
    }

    if (s.pendingChoice) {
      return { state: s, events, waitingFor: s.pendingChoice };
    }
    return { state: s, events };
  }

  // Build initial queue from the action
  const queue = buildInitialQueue(state, player, action);
  const result = drainQueue({ ...state, stepQueue: queue }, []);

  if (result.state.pendingChoice) {
    return { state: result.state, events: result.events, waitingFor: result.state.pendingChoice };
  }
  return { state: result.state, events: result.events };
}

// --- Queue Builders ---

function buildInitialQueue(
  state: GameState,
  player: PlayerId,
  action: PlayerAction,
): EngineStep[] {
  switch (action.type) {
    case 'gain_mythium':
      return advanceTurn([
        { type: 'gain_mythium', player, amount: 1 },
      ]);
    case 'draw_card':
      return advanceTurn([
        { type: 'draw_card', player },
      ]);
    case 'buy_standing':
      return advanceTurn([
        { type: 'spend_mythium', player, amount: 2 },
        { type: 'gain_standing', player, guild: action.guild, amount: 1 },
      ]);
    case 'play_card':
      return advanceTurn(playCard(state, player, action.cardInstanceId));
    case 'attack':
      return advanceTurn(buildAttackQueue(state, player, action.attackerIds));
    case 'develop':
      return advanceTurn(handleDevelop(state, player, action.locationInstanceId));
    case 'use_ability':
      return advanceTurn(buildUseAbilityQueue(player, action.cardInstanceId, action.abilityIndex));
    default:
      throw new Error(`Unhandled action type: ${(action as PlayerAction).type}`);
  }
}

function advanceTurn(
  steps: EngineStep[],
): EngineStep[] {
  return [...steps, { type: 'advance_turn' }];
}

export function playCard(
  state: GameState,
  player: PlayerId,
  cardInstanceId: string,
  opts?: { costReduction?: number },
): EngineStep[] {
  const card = getCard(state, cardInstanceId)!;
  const def = getCardDef(card);

  const steps: EngineStep[] = [];

  // Pay mythium cost
  const passiveReduction = getPassiveCostReduction(state, player, def);
  const actualCost = Math.max(0, def.cost - passiveReduction - (opts?.costReduction ?? 0));
  if (actualCost > 0) {
    steps.push({ type: 'spend_mythium', player, amount: actualCost });
  }

  if (def.type === 'event') {
    // Events go to discard
    steps.push({ type: 'move_card', cardInstanceId, toZone: 'discard' });
  } else {
    // Followers and locations enter board
    steps.push({ type: 'move_card', cardInstanceId, toZone: 'board' });
  }

  steps.push({ type: 'card_played', player, cardInstanceId });

  // Location stage counters
  if (def.type === 'location' && def.stages && def.stages > 0) {
    steps.push({ type: 'add_counter', cardInstanceId, counter: 'stage', amount: def.stages });
  }

  // Queue abilities
  const abilityTiming = def.type === 'event' ? 'play' : 'enters';
  if (def.abilities) {
    for (let i = 0; i < def.abilities.length; i++) {
      if (def.abilities[i].timing === abilityTiming) {
        steps.push({ type: 'resolve_ability_at_index', controller: player, sourceCardId: cardInstanceId, abilityIndex: i });
      }
    }
  }

  steps.push({ type: 'cleanup' });

  return steps;
}

function buildUseAbilityQueue(
  player: PlayerId,
  cardInstanceId: string,
  abilityIndex: number,
): EngineStep[] {
  return [{ type: 'resolve_ability_at_index', controller: player, sourceCardId: cardInstanceId, abilityIndex }];
}

function buildAttackQueue(
  state: GameState,
  player: PlayerId,
  attackerIds: string[],
): EngineStep[] {
  const defender = opponentOf(player);
  const steps: EngineStep[] = [];

  // Exhaust all attackers
  for (const id of attackerIds) {
    steps.push({ type: 'exhaust_card', cardInstanceId: id });
  }

  // Create combat state
  steps.push({ type: 'combat_start', attackingPlayer: player, attackerIds });

  // "Your Attack:" triggers
  steps.push({ type: 'check_triggers', timing: 'your_attack', player });

  // "Attacks:" triggers for individual attackers
  for (const id of attackerIds) {
    const card = getCard(state, id);
    if (!card) continue;
    const def = getCardDef(card);
    if (def.abilities) {
      for (let i = 0; i < def.abilities.length; i++) {
        if (def.abilities[i].timing === 'attacks') {
          steps.push({ type: 'check_triggers', timing: 'attacks', player, triggeringCardId: id });
          break; // One check_triggers per card is enough
        }
      }
    }
  }

  steps.push(
    { type: 'cleanup' },
    { type: 'combat_declare_blockers', defender, attackerIds },
    { type: 'combat_end' }
  );

  return steps;
}

// --- Choice Resolution ---

interface ChoiceResult {
  state: GameState;
  events: GameEvent[];
  prepend?: EngineStep[];
}

function resolveChoice(
  state: GameState,
  player: PlayerId,
  action: PlayerAction,
): ChoiceResult {
  const choice = state.pendingChoice!;

  switch (choice.type) {
    case 'choose_target':
      return resolveChooseTarget(state, player, action);
    case 'choose_discard':
      return resolveChooseDiscard(state, player, action);
    case 'choose_mode':
      return resolveChooseMode(state, player, action);
    case 'choose_blockers':
      return resolveChooseBlockers(state, player, action);
    case 'choose_breach_target':
      return resolveChooseBreachTarget(state, player, action);
    case 'choose_attackers':
      return resolveChooseAttackers(state, player, action);
    case 'choose_trigger_order':
      return resolveChooseTriggerOrder(state, player, action);
    default:
      throw new Error(`Unknown choice type: ${(choice as PendingChoice).type}`);
  }
}

function resolveChooseTarget(state: GameState, _player: PlayerId, action: PlayerAction): ChoiceResult {
  if (action.type !== 'choose_target') throw new Error('Expected choose_target');
  const choice = state.pendingChoice!;
  if (choice.type !== 'choose_target') throw new Error('Expected choose_target choice');

  let s: GameState = { ...state, pendingChoice: null };

  const ctx: ResolveContext = {
    controller: choice.playerId,
    sourceCardId: choice.sourceCardId,
    triggeringCardId: choice.triggeringCardId,
    chosenTargets: [action.targetInstanceId],
  };

  const prepend: EngineStep[] = [
    { type: 'resolve_effects', effects: choice.effects, ctx },
    { type: 'cleanup' },
  ];

  return { state: s, events: [], prepend };
}

function resolveChooseDiscard(state: GameState, _player: PlayerId, action: PlayerAction): ChoiceResult {
  if (action.type !== 'choose_discard') throw new Error('Expected choose_discard');
  const choice = state.pendingChoice!;
  if (choice.type !== 'choose_discard') throw new Error('Expected choose_discard choice');

  let s: GameState = { ...state, pendingChoice: null };
  const events: GameEvent[] = [];

  for (const cardId of action.cardInstanceIds) {
    const moveResult = moveCard(s, cardId, 'discard');
    s = moveResult.state;
    events.push(...moveResult.events);
    const card = getCard(state, cardId);
    if (card) {
      events.push({ type: 'card_discarded', player: card.owner, cardInstanceId: cardId });
    }
  }

  return { state: s, events };
}

function resolveChooseMode(state: GameState, _player: PlayerId, action: PlayerAction): ChoiceResult {
  if (action.type !== 'choose_mode') throw new Error('Expected choose_mode');
  const choice = state.pendingChoice!;
  if (choice.type !== 'choose_mode') throw new Error('Expected choose_mode choice');

  let s: GameState = { ...state, pendingChoice: null };
  const selectedMode = choice.modes[action.modeIndex];
  const ctx: ResolveContext = {
    controller: choice.playerId,
    sourceCardId: choice.sourceCardId,
  };
  const effectResult = resolveEffectsWithQueue(s, selectedMode.effects, ctx);
  s = effectResult.state;
  const events = [...effectResult.events];

  return { state: s, events, prepend: [...(effectResult.prepend ?? []), { type: 'cleanup' }] };
}

function resolveChooseBlockers(state: GameState, _player: PlayerId, action: PlayerAction): ChoiceResult {
  if (action.type === 'declare_blocker') {
    return resolveDeclareBlocker(state, action.blockerId, action.attackerId);
  } else if (action.type === 'pass_block') {
    return resolvePassBlock(state);
  }
  throw new Error('Expected declare_blocker or pass_block');
}

function resolveDeclareBlocker(state: GameState, blockerId: string, attackerId: string): ChoiceResult {
  const s: GameState = { ...state, pendingChoice: null };
  return {
    state: s,
    events: [],
    prepend: [{ type: 'combat_fight', attackerId, blockerId }],
  };
}

function resolvePassBlock(state: GameState): ChoiceResult {
  if (!state.combat) return { state, events: [] };

  const s: GameState = { ...state, pendingChoice: null };
  const remainingAttackerIds = state.combat.attackerIds;

  // Check which attackers are still on the board
  const livingAttackerIds = remainingAttackerIds.filter(
    id => s.cards.some(c => c.instanceId === id && c.zone === 'board')
  );

  if (livingAttackerIds.length > 0) {
    return {
      state: s,
      events: [],
      prepend: [{ type: 'combat_breach', livingAttackerIds }],
    };
  }

  // No living attackers — end combat
  return { state: s, events: [], prepend: [{ type: 'combat_end' }] };
}

function resolveChooseBreachTarget(state: GameState, _player: PlayerId, action: PlayerAction): ChoiceResult {
  let s: GameState = { ...state, pendingChoice: null };
  const events: GameEvent[] = [];
  const prepend: EngineStep[] = [];

  if (action.type === 'damage_location') {
    const location = getCard(s, action.locationInstanceId);
    if (location) {
      const removeResult = removeCounterFromCard(s, action.locationInstanceId, 'stage', 1);
      s = removeResult.state;
      events.push(...removeResult.events);
      events.push({ type: 'location_damaged', locationInstanceId: action.locationInstanceId, amount: 1 });
      prepend.push({ type: 'cleanup' });
    }
  }
  // skip_breach_damage: just continue to combat_end

  return { state: s, events, prepend: [...prepend, { type: 'combat_end' }] };
}

function resolveChooseAttackers(state: GameState, _player: PlayerId, action: PlayerAction): ChoiceResult {
  if (action.type !== 'choose_attackers') throw new Error('Expected choose_attackers');
  const choice = state.pendingChoice!;
  if (choice.type !== 'choose_attackers') throw new Error('Expected choose_attackers choice');

  let s: GameState = { ...state, pendingChoice: null };
  const events: GameEvent[] = [];

  const queue = buildAttackQueue(s, choice.playerId, action.attackerIds);
  return { state: s, events, prepend: queue };
}

function resolveChooseTriggerOrder(state: GameState, _player: PlayerId, action: PlayerAction): ChoiceResult {
  if (action.type !== 'choose_trigger') throw new Error('Expected choose_trigger');
  const choice = state.pendingChoice!;
  if (choice.type !== 'choose_trigger_order') throw new Error('Expected choose_trigger_order choice');

  const selected = choice.triggers[action.triggerIndex];
  const remaining = choice.triggers.filter((_, i) => i !== action.triggerIndex);

  const s: GameState = { ...state, pendingChoice: null };

  const prepend: EngineStep[] = [
    { type: 'resolve_ability_at_index', controller: choice.playerId, sourceCardId: selected.sourceCardId, abilityIndex: selected.abilityIndex, triggeringCardId: selected.triggeringCardId },
    { type: 'cleanup' },
  ];

  if (remaining.length > 0) {
    prepend.push({ type: 'order_triggers', player: choice.playerId, triggers: remaining });
  }

  return { state: s, events: [], prepend };
}

import { handleDevelop } from "../actions/develop";

/**
 * Compute all legal actions for the current game state.
 */
export function getLegalActions(state: GameState): ActionInput[] {
  if (state.phase === 'gameOver') return [];

  // If pending choice
  if (state.pendingChoice) {
    return getLegalChoiceActions(state);
  }

  // If combat
  if (state.combat) {
    return getLegalCombatActions(state);
  }

  const player = state.activePlayer;
  const actions: ActionInput[] = [];

  // Gain mythium (always available)
  actions.push({ player, action: { type: 'gain_mythium' } });

  // Draw card (always available)
  actions.push({ player, action: { type: 'draw_card' } });

  // Buy standing (if has 2+ mythium)
  if (state.players[player].mythium >= 2) {
    for (const guild of STANDING_GUILDS) {
      actions.push({ player, action: { type: 'buy_standing', guild } });
    }
  }

  // Play cards from hand
  const hand = getHand(state, player);
  for (const card of hand) {
    if (canPlayCard(state, player, card)) {
      actions.push({ player, action: { type: 'play_card', cardInstanceId: card.instanceId } });
    }
  }

  // Attack with followers
  const attackable = getFollowers(state, player).filter(f => canAttack(state, f));
  if (attackable.length > 0) {
    for (const f of attackable) {
      actions.push({ player, action: { type: 'attack', attackerIds: [f.instanceId] } });
    }
    if (attackable.length > 1) {
      actions.push({ player, action: { type: 'attack', attackerIds: attackable.map(f => f.instanceId) } });
    }
  }

  // Develop locations
  const locations = getLocations(state, player);
  for (const loc of locations) {
    if (canDevelop(state, player, loc)) {
      actions.push({ player, action: { type: 'develop', locationInstanceId: loc.instanceId } });
    }
  }

  // Use abilities
  const board = getBoard(state, player);
  for (const card of board) {
    const def = getCardDef(card);
    if (def.abilities) {
      for (let i = 0; i < def.abilities.length; i++) {
        if (canUseAbility(state, player, card, i)) {
          actions.push({ player, action: { type: 'use_ability', cardInstanceId: card.instanceId, abilityIndex: i } });
        }
      }
    }
  }

  return actions;
}

function getLegalChoiceActions(state: GameState): ActionInput[] {
  const choice = state.pendingChoice!;
  const player = choice.playerId;
  const actions: ActionInput[] = [];

  switch (choice.type) {
    case 'choose_target': {
      const { filter } = choice;
      const validCards = state.cards.filter(c => {
        const def = getCardDef(c);
        if (filter.type) {
          const types = Array.isArray(filter.type) ? filter.type : [filter.type];
          if (!types.includes(def.type)) return false;
        }
        if (filter.zone) {
          const zones = Array.isArray(filter.zone) ? filter.zone : [filter.zone];
          if (!zones.includes(c.zone)) return false;
        }
        if (filter.owner === 'controller' && c.owner !== player) return false;
        if (filter.owner === 'opponent' && c.owner === player) return false;
        if (filter.keyword && !hasKeyword(state, c, filter.keyword)) return false;
        if (filter.notKeyword && hasKeyword(state, c, filter.notKeyword)) return false;
        if (filter.maxCost !== undefined && def.cost > filter.maxCost) return false;
        if (filter.cardInstanceIds && !filter.cardInstanceIds.includes(c.instanceId)) return false;
        if (filter.canPay && !canPay(state, player, c, { costReduction: filter.canPay.costReduction })) return false;
        if (filter.wounded !== undefined) {
          const wounds = getCounter(c.counters, 'wound');
          if (filter.wounded && wounds <= 0) return false;
          if (!filter.wounded && wounds > 0) return false;
        }
        return true;
      });
      for (const card of validCards) {
        actions.push({ player, action: { type: 'choose_target', targetInstanceId: card.instanceId } });
      }
      break;
    }
    case 'choose_discard': {
      const hand = getHand(state, player);
      for (const card of hand) {
        actions.push({ player, action: { type: 'choose_discard', cardInstanceIds: [card.instanceId] } });
      }
      break;
    }
    case 'choose_blockers': {
      actions.push({ player, action: { type: 'pass_block' } });
      const defenders = getFollowers(state, player).filter(f => canBlock(state, f));
      if (state.combat) {
        for (const def of defenders) {
          for (const attackerId of state.combat.attackerIds) {
            if (canBlockAttacker(state, def, attackerId)) {
              actions.push({
                player,
                action: { type: 'declare_blocker', blockerId: def.instanceId, attackerId },
              });
            }
          }
        }
      }
      break;
    }
    case 'choose_breach_target': {
      actions.push({ player, action: { type: 'skip_breach_damage' } });
      for (const locId of choice.validLocationIds) {
        actions.push({ player, action: { type: 'damage_location', locationInstanceId: locId } });
      }
      break;
    }
    case 'choose_mode': {
      for (let i = 0; i < choice.modes.length; i++) {
        actions.push({ player, action: { type: 'choose_mode', modeIndex: i } });
      }
      break;
    }
    case 'choose_attackers': {
      const attackable = getFollowers(state, player).filter(f => canAttack(state, f));
      for (const f of attackable) {
        actions.push({ player, action: { type: 'choose_attackers', attackerIds: [f.instanceId] } });
      }
      if (attackable.length > 1) {
        actions.push({ player, action: { type: 'choose_attackers', attackerIds: attackable.map(f => f.instanceId) } });
      }
      break;
    }
    case 'choose_trigger_order': {
      for (let i = 0; i < choice.triggers.length; i++) {
        actions.push({ player, action: { type: 'choose_trigger', triggerIndex: i } });
      }
      break;
    }
  }

  return actions;
}

function getLegalCombatActions(state: GameState): ActionInput[] {
  if (!state.combat) return [];

  const actions: ActionInput[] = [];
  const defender = opponentOf(state.combat.attackingPlayer);

  switch (state.combat.step) {
    case 'resolve_attack_abilities': {
      // Engine-driven step; no direct player actions.
      break;
    }
    case 'declare_blockers': {
      actions.push({ player: defender, action: { type: 'pass_block' } });
      const blockers = getFollowers(state, defender).filter(f => canBlock(state, f));
      for (const b of blockers) {
        for (const attackerId of state.combat.attackerIds) {
          if (canBlockAttacker(state, b, attackerId)) {
            actions.push({
              player: defender,
              action: { type: 'declare_blocker', blockerId: b.instanceId, attackerId },
            });
          }
        }
      }
      break;
    }
    case 'breach': {
      const attacker = state.combat.attackingPlayer;
      actions.push({ player: attacker, action: { type: 'skip_breach_damage' } });
      const locations = getLocations(state, defender);
      for (const loc of locations) {
        actions.push({ player: attacker, action: { type: 'damage_location', locationInstanceId: loc.instanceId } });
      }
      break;
    }
  }

  return actions;
}

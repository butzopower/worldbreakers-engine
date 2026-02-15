import { GameState, PendingChoice } from '../types/state';
import { ActionInput, PlayerAction } from '../types/actions';
import { GameEvent } from '../types/events';
import { PlayerId, STANDING_GUILDS, opponentOf } from '../types/core';
import { validateAction } from './validator';
import { advanceTurn } from './phases';
import { runCleanup } from './cleanup';

import { handleGainMythium } from '../actions/gain-mythium';
import { handleDrawCard } from '../actions/draw-card';
import { handleBuyStanding } from '../actions/buy-standing';
import { handlePlayCard } from '../actions/play-card';
import { handleAttack } from '../actions/attack';
import { handleDevelop } from '../actions/develop';
import { handleUseAbility } from '../actions/use-ability';
import { declareBlocker, passBlock, endCombat, resumeBreach } from '../combat/combat';
import { handleBreachDamage, handleSkipBreachDamage } from '../combat/breach';
import { resolveEffects } from '../abilities/resolver';
import { ResolveContext, findValidTargets, resolvePrimitive } from '../abilities/primitives';
import { moveCard, gainPower } from '../state/mutate';
import { getCard, getHand, getCardDef, canPay } from '../state/query';
import {
  canPlayCard, canAttack, canBlock, canDevelop, canUseAbility,
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
  let result: { state: GameState; events: GameEvent[] };

  // Handle pending choices first
  if (state.pendingChoice) {
    result = handlePendingChoice(state, player, action);
  } else if (state.combat) {
    result = handleCombatAction(state, player, action);
  } else {
    result = handleActionPhaseAction(state, player, action);
  }

  let s = result.state;
  const events = result.events;

  // If a new pending choice was created, return waiting
  if (s.pendingChoice) {
    return { state: s, events, waitingFor: s.pendingChoice };
  }

  // If combat is still active and needs input, check
  if (s.combat) {
    if (s.combat.step === 'declare_blockers') {
      const defender = opponentOf(s.combat.attackingPlayer);
      return {
        state: s,
        events,
        waitingFor: {
          type: 'choose_blockers',
          playerId: defender,
          attackerIds: s.combat.attackerIds,
        },
      };
    }
  }

  return { state: s, events };
}

function handleActionPhaseAction(
  state: GameState,
  player: PlayerId,
  action: PlayerAction,
): { state: GameState; events: GameEvent[] } {
  let result: { state: GameState; events: GameEvent[] };

  switch (action.type) {
    case 'gain_mythium':
      result = handleGainMythium(state, player);
      break;
    case 'draw_card':
      result = handleDrawCard(state, player);
      break;
    case 'buy_standing':
      result = handleBuyStanding(state, player, action.guild);
      break;
    case 'play_card':
      result = handlePlayCard(state, player, action.cardInstanceId);
      break;
    case 'attack':
      result = handleAttack(state, player, action.attackerIds);
      // Attack doesn't consume a turn action - it initiates combat
      // But combat itself is the action, so we do advance after combat resolves
      // Actually, attack IS the action - advance turn
      // But we need to wait for combat to resolve first
      if (result.state.combat || result.state.pendingChoice) {
        return result; // Don't advance turn yet - combat in progress
      }
      break;
    case 'develop':
      result = handleDevelop(state, player, action.locationInstanceId);
      break;
    case 'use_ability':
      result = handleUseAbility(state, player, action.cardInstanceId, action.abilityIndex);
      break;
    default:
      throw new Error(`Unhandled action type in action phase: ${action.type}`);
  }

  // If there's a pending choice or combat, don't advance turn yet
  if (result.state.pendingChoice || result.state.combat) {
    return result;
  }

  // Advance turn (increment action count, switch player)
  return advanceTurn(result.state, result.events);
}

function handleCombatAction(
  state: GameState,
  player: PlayerId,
  action: PlayerAction,
): { state: GameState; events: GameEvent[] } {
  let result: { state: GameState; events: GameEvent[] };

  switch (action.type) {
    case 'declare_blocker':
      result = declareBlocker(state, action.blockerId, action.attackerId);
      break;
    case 'pass_block':
      result = passBlock(state);
      break;
    case 'damage_location':
      result = handleBreachDamage(state, action.locationInstanceId);
      break;
    case 'skip_breach_damage':
      result = handleSkipBreachDamage(state);
      break;
    default:
      throw new Error(`Invalid combat action: ${action.type}`);
  }

  // If combat ended, advance turn
  if (!result.state.combat && !result.state.pendingChoice) {
    return advanceTurn(result.state, result.events);
  }

  return result;
}

function handlePendingChoice(
  state: GameState,
  player: PlayerId,
  action: PlayerAction,
): { state: GameState; events: GameEvent[] } {
  const choice = state.pendingChoice!;
  let s = state;
  const events: GameEvent[] = [];

  switch (choice.type) {
    case 'choose_target': {
      if (action.type !== 'choose_target') throw new Error('Expected choose_target');
      s = { ...s, pendingChoice: null };

      const ctx: ResolveContext = {
        controller: choice.playerId,
        sourceCardId: choice.sourceCardId,
        triggeringCardId: choice.triggeringCardId,
        chosenTargets: [action.targetInstanceId],
      };
      const effectResult = resolveEffects(s, choice.effects, ctx);
      s = effectResult.state;
      events.push(...effectResult.events);

      const cleanupResult = runCleanup(s);
      s = cleanupResult.state;
      events.push(...cleanupResult.events);

      break;
    }

    case 'choose_discard': {
      if (action.type !== 'choose_discard') throw new Error('Expected choose_discard');
      s = { ...s, pendingChoice: null };
      for (const cardId of action.cardInstanceIds) {
        const moveResult = moveCard(s, cardId, 'discard');
        s = moveResult.state;
        events.push(...moveResult.events);
        const card = getCard(state, cardId);
        if (card) {
          events.push({ type: 'card_discarded', player: card.owner, cardInstanceId: cardId });
        }
      }

      // Handle Void Rift multi-phase discard
      if (choice.nextPhase === 'controller_discard') {
        const controller = opponentOf(choice.playerId);
        const controllerHand = getHand(s, controller);
        if (controllerHand.length > 0) {
          s = {
            ...s,
            pendingChoice: {
              type: 'choose_discard',
              playerId: controller,
              count: 1,
              sourceCardId: choice.sourceCardId,
              phase: 'controller_discard',
              nextPhase: 'gain_power',
            },
          };
          return { state: s, events };
        }
        // Fall through to gain power
        const powerResult = gainPower(s, controller, 1);
        s = powerResult.state;
        events.push(...powerResult.events);
      } else if (choice.nextPhase === 'gain_power') {
        const powerResult = gainPower(s, choice.playerId, 1);
        s = powerResult.state;
        events.push(...powerResult.events);
      }

      break;
    }

    case 'choose_blockers': {
      if (action.type === 'declare_blocker') {
        const result = declareBlocker(s, action.blockerId, action.attackerId);
        // If combat ended, advance turn
        if (!result.state.combat && !result.state.pendingChoice) {
          return advanceTurn(result.state, result.events);
        }
        return result;
      } else if (action.type === 'pass_block') {
        const result = passBlock(s);
        // If combat ended, advance turn
        if (!result.state.combat && !result.state.pendingChoice) {
          return advanceTurn(result.state, result.events);
        }
        return result;
      }
      throw new Error('Expected declare_blocker or pass_block');
    }

    case 'choose_breach_target': {
      let result: { state: GameState; events: GameEvent[] };
      if (action.type === 'damage_location') {
        result = handleBreachDamage(s, action.locationInstanceId);
      } else if (action.type === 'skip_breach_damage') {
        result = handleSkipBreachDamage(s);
      } else {
        throw new Error('Expected damage_location or skip_breach_damage');
      }
      if (!result.state.combat && !result.state.pendingChoice) {
        return advanceTurn(result.state, result.events);
      }
      return result;
    }

    case 'choose_mode': {
      if (action.type !== 'choose_mode') throw new Error('Expected choose_mode');
      s = { ...s, pendingChoice: null };
      const selectedMode = choice.modes[action.modeIndex];
      const ctx: ResolveContext = {
        controller: choice.playerId,
        sourceCardId: choice.sourceCardId,
      };
      const effectResult = resolveEffects(s, selectedMode.effects, ctx);
      s = effectResult.state;
      events.push(...effectResult.events);

      const cleanupResult = runCleanup(s);
      s = cleanupResult.state;
      events.push(...cleanupResult.events);
      break;
    }

  }

  // Process remaining effects if no pending choice was set
  if (!s.pendingChoice && s.remainingEffects) {
    const remaining = s.remainingEffects;
    s = { ...s, remainingEffects: undefined };

    const remainCtx: ResolveContext = {
      controller: remaining.controller,
      sourceCardId: remaining.sourceCardId,
      triggeringCardId: remaining.triggeringCardId,
    };

    for (let i = 0; i < remaining.effects.length; i++) {
      const effect = remaining.effects[i];

      if ('target' in effect && effect.target && effect.target.kind === 'choose') {
        const validTargets = findValidTargets(s, effect.target, remainCtx);
        if (validTargets.length === 0) {
          continue;
        }

        const nextRemaining = remaining.effects.slice(i + 1);
        s = {
          ...s,
          pendingChoice: {
            type: 'choose_target',
            playerId: remaining.controller,
            sourceCardId: remaining.sourceCardId,
            abilityIndex: 0,
            effects: [effect],
            filter: effect.target.filter,
            triggeringCardId: remaining.triggeringCardId,
          },
        };
        if (nextRemaining.length > 0) {
          s.remainingEffects = { effects: nextRemaining, controller: remaining.controller, sourceCardId: remaining.sourceCardId, triggeringCardId: remaining.triggeringCardId };
        }
        break;
      }

      const r = resolvePrimitive(s, effect, remainCtx);
      s = r.state;
      events.push(...r.events);
      if (s.pendingChoice) break;
    }
  }

  // If a pending choice was resolved during breach, resume the breach flow
  // (power gain + location damage choice).
  if (!s.pendingChoice && s.combat?.step === 'breach') {
    const breachResult = resumeBreach(s);
    s = breachResult.state;
    events.push(...breachResult.events);
  }

  // If no more pending and no combat, may need to advance turn
  if (!s.pendingChoice && !s.combat) {
    // Check if this was part of a card play or other action
    return advanceTurn(s, events);
  }

  return { state: s, events };
}

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
    // Generate combinations (at least 1 attacker)
    // For simplicity, generate single and all-attacker options
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
        if (filter.canPay && !canPay(state, player, c, { costReduction: filter.canPay.costReduction })) return false;
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
            actions.push({
              player,
              action: { type: 'declare_blocker', blockerId: def.instanceId, attackerId },
            });
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
  }

  return actions;
}

function getLegalCombatActions(state: GameState): ActionInput[] {
  if (!state.combat) return [];

  const actions: ActionInput[] = [];
  const defender = opponentOf(state.combat.attackingPlayer);

  switch (state.combat.step) {
    case 'declare_blockers': {
      actions.push({ player: defender, action: { type: 'pass_block' } });
      const blockers = getFollowers(state, defender).filter(f => canBlock(state, f));
      for (const b of blockers) {
        for (const attackerId of state.combat.attackerIds) {
          actions.push({
            player: defender,
            action: { type: 'declare_blocker', blockerId: b.instanceId, attackerId },
          });
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

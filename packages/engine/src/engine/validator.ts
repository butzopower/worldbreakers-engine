import { GameState, PendingChoiceChooseTarget } from '../types/state';
import { ActionInput, PlayerAction } from '../types/actions';
import { PlayerId, opponentOf } from '../types/core';
import {
  getCard, getCardDef, canPlayCard, canAttack, canBlock, canBlockAttacker, canDevelop, canUseAbility, canPay,
  getFollowers, getHand, getLocations, hasKeyword,
} from '../state/query';
import { getCounter } from '../types/counters';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateAction(state: GameState, input: ActionInput): ValidationResult {
  const { player, action } = input;

  // Check if game is over
  if (state.phase === 'gameOver') {
    return { valid: false, reason: 'Game is over' };
  }

  // If there's a pending choice, only that player can act and only with relevant action
  if (state.pendingChoice) {
    return validatePendingChoice(state, player, action);
  }

  // If combat is active, only combat actions are allowed
  if (state.combat) {
    return validateCombatAction(state, player, action);
  }

  // Normal action phase - must be active player
  if (state.phase !== 'action') {
    return { valid: false, reason: `Cannot act during ${state.phase} phase` };
  }

  if (player !== state.activePlayer) {
    return { valid: false, reason: 'Not your turn' };
  }

  switch (action.type) {
    case 'gain_mythium':
      return { valid: true };

    case 'draw_card':
      return { valid: true };

    case 'buy_standing':
      return validateBuyStanding(state, player);

    case 'play_card':
      return validatePlayCard(state, player, action.cardInstanceId);

    case 'attack':
      return validateAttack(state, player, action.attackerIds);

    case 'develop':
      return validateDevelop(state, player, action.locationInstanceId);

    case 'use_ability':
      return validateUseAbility(state, player, action.cardInstanceId, action.abilityIndex);

    default:
      return { valid: false, reason: 'Invalid action type for action phase' };
  }
}

function validateBuyStanding(state: GameState, player: PlayerId): ValidationResult {
  if (state.players[player].mythium < 2) {
    return { valid: false, reason: 'Not enough mythium (need 2)' };
  }
  return { valid: true };
}

function validatePlayCard(state: GameState, player: PlayerId, cardInstanceId: string): ValidationResult {
  const card = getCard(state, cardInstanceId);
  if (!card) return { valid: false, reason: 'Card not found' };
  if (!canPlayCard(state, player, card)) {
    return { valid: false, reason: 'Cannot play this card (wrong zone, not enough mythium, or standing requirement)' };
  }
  return { valid: true };
}

function validateAttack(state: GameState, player: PlayerId, attackerIds: string[]): ValidationResult {
  if (attackerIds.length === 0) {
    return { valid: false, reason: 'Must declare at least one attacker' };
  }
  for (const id of attackerIds) {
    const card = getCard(state, id);
    if (!card) return { valid: false, reason: `Attacker ${id} not found` };
    if (card.owner !== player) return { valid: false, reason: `Card ${id} is not yours` };
    if (!canAttack(state, card)) return { valid: false, reason: `Card ${id} cannot attack` };
  }
  return { valid: true };
}

function validateDevelop(state: GameState, player: PlayerId, locationInstanceId: string): ValidationResult {
  const card = getCard(state, locationInstanceId);
  if (!card) return { valid: false, reason: 'Location not found' };
  if (!canDevelop(state, player, card)) {
    return { valid: false, reason: 'Cannot develop this location' };
  }
  return { valid: true };
}

function validateUseAbility(state: GameState, player: PlayerId, cardInstanceId: string, abilityIndex: number): ValidationResult {
  const card = getCard(state, cardInstanceId);
  if (!card) return { valid: false, reason: 'Card not found' };
  if (!canUseAbility(state, player, card, abilityIndex)) {
    return { valid: false, reason: 'Cannot use this ability' };
  }
  return { valid: true };
}

function validatePendingChoice(state: GameState, player: PlayerId, action: PlayerAction): ValidationResult {
  const choice = state.pendingChoice!;

  if (player !== choice.playerId) {
    return { valid: false, reason: 'Not your choice to make' };
  }

  switch (choice.type) {
    case 'choose_blockers':
      if (action.type !== 'declare_blocker' && action.type !== 'pass_block') {
        return { valid: false, reason: 'Must declare a blocker or pass' };
      }
      if (action.type === 'declare_blocker') {
        return validateBlockerAssignment(state, player, action.blockerId, action.attackerId);
      }
      return { valid: true };

    case 'choose_target':
      if (action.type !== 'choose_target') {
        return { valid: false, reason: 'Must choose a target' };
      }
      return validateChooseTarget(state, player, action.targetInstanceId, choice);

    case 'choose_discard':
      if (action.type !== 'choose_discard') {
        return { valid: false, reason: 'Must choose cards to discard' };
      }
      return validateDiscardChoice(state, player, action.cardInstanceIds);

    case 'choose_breach_target':
      if (action.type !== 'damage_location' && action.type !== 'skip_breach_damage') {
        return { valid: false, reason: 'Must choose a location to damage or skip' };
      }
      return { valid: true };

    case 'choose_mode':
      if (action.type !== 'choose_mode') {
        return { valid: false, reason: 'Must choose a mode' };
      }
      if (action.modeIndex < 0 || action.modeIndex >= choice.modes.length) {
        return { valid: false, reason: 'Invalid mode index' };
      }
      return { valid: true };

    case 'choose_attackers':
      if (action.type !== 'choose_attackers') {
        return { valid: false, reason: 'Must choose attackers' };
      }
      return validateAttack(state, player, action.attackerIds);

    default:
      return { valid: false, reason: 'Unknown choice type' };
  }
}

function validateBlockerAssignment(state: GameState, player: PlayerId, blockerId: string, attackerId: string): ValidationResult {
  const blocker = getCard(state, blockerId);
  if (!blocker) return { valid: false, reason: `Blocker ${blockerId} not found` };
  if (blocker.owner !== player) return { valid: false, reason: `${blockerId} is not yours` };
  if (!canBlock(state, blocker)) return { valid: false, reason: `${blockerId} cannot block` };

  if (!state.combat?.attackerIds.includes(attackerId)) {
    return { valid: false, reason: `${attackerId} is not an attacker` };
  }
  if (!canBlockAttacker(state, blocker, attackerId)) {
    return { valid: false, reason: `${blockerId} cannot block ${attackerId}` };
  }
  return { valid: true };
}

function validateDiscardChoice(state: GameState, player: PlayerId, cardIds: string[]): ValidationResult {
  const pending = state.pendingChoice;
  const expectedCount = (pending?.type === 'choose_discard' ? pending.count : 1);
  const hand = getHand(state, player);

  const actualCount = Math.min(expectedCount, hand.length);
  if (cardIds.length !== actualCount) {
    return { valid: false, reason: `Must discard exactly ${actualCount} card(s)` };
  }

  for (const id of cardIds) {
    const card = getCard(state, id);
    if (!card) return { valid: false, reason: `Card ${id} not found` };
    if (card.owner !== player || card.zone !== 'hand') {
      return { valid: false, reason: `Card ${id} is not in your hand` };
    }
  }
  return { valid: true };
}

function validateChooseTarget(
  state: GameState,
  player: PlayerId,
  targetInstanceId: string,
  choice: PendingChoiceChooseTarget,
): ValidationResult {
  const card = getCard(state, targetInstanceId);
  if (!card) return { valid: false, reason: 'Target not found' };

  const { filter } = choice;
  const def = getCardDef(card);
  if (filter.type) {
    const types = Array.isArray(filter.type) ? filter.type : [filter.type];
    if (!types.includes(def.type)) return { valid: false, reason: 'Target does not match required type' };
  }
  if (filter.zone) {
    const zones = Array.isArray(filter.zone) ? filter.zone : [filter.zone];
    if (!zones.includes(card.zone)) return { valid: false, reason: 'Target is not in valid zone' };
  }
  if (filter.owner === 'controller' && card.owner !== player) return { valid: false, reason: 'Target is not yours' };
  if (filter.owner === 'opponent' && card.owner === player) return { valid: false, reason: 'Target must belong to opponent' };
  if (filter.keyword && !hasKeyword(state, card, filter.keyword)) return { valid: false, reason: 'Target does not have required keyword' };
  if (filter.notKeyword && hasKeyword(state, card, filter.notKeyword)) return { valid: false, reason: 'Target has excluded keyword' };
  if (filter.maxCost !== undefined && def.cost > filter.maxCost) return { valid: false, reason: 'Target cost exceeds maximum' };
  if (filter.cardInstanceIds && !filter.cardInstanceIds.includes(card.instanceId)) return { valid: false, reason: 'Target does not match card instance' };
  if (filter.canPay && !canPay(state, player, card, { costReduction: filter.canPay.costReduction })) {
    return { valid: false, reason: 'Cannot afford this card' };
  }
  if (filter.wounded !== undefined) {
    const wounds = getCounter(card.counters, 'wound');
    if (filter.wounded && wounds <= 0) return { valid: false, reason: 'Target is not wounded' };
    if (!filter.wounded && wounds > 0) return { valid: false, reason: 'Target must not be wounded' };
  }

  return { valid: true };
}

function validateCombatAction(state: GameState, player: PlayerId, action: PlayerAction): ValidationResult {
  if (!state.combat) return { valid: false, reason: 'No active combat' };

  const defending = opponentOf(state.combat.attackingPlayer);

  switch (state.combat.step) {
    case 'declare_blockers':
      if (player !== defending) return { valid: false, reason: 'Only defender can declare blockers' };
      if (action.type !== 'declare_blocker' && action.type !== 'pass_block') {
        return { valid: false, reason: 'Must declare a blocker or pass' };
      }
      if (action.type === 'declare_blocker') {
        return validateBlockerAssignment(state, player, action.blockerId, action.attackerId);
      }
      return { valid: true };

    case 'breach':
      if (player !== state.combat.attackingPlayer) return { valid: false, reason: 'Only attacker can choose breach target' };
      if (action.type !== 'damage_location' && action.type !== 'skip_breach_damage') {
        return { valid: false, reason: 'Must choose location damage or skip' };
      }
      return { valid: true };

    default:
      return { valid: false, reason: `Cannot act during ${state.combat.step} step` };
  }
}

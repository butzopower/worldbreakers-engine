import { PlayerId, PLAYERS, opponentOf } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { drawCard, gainMythium, gainPower, readyCard } from '../state/mutate';
import { getCounter } from '../types/counters';
import { removeCounterFromCard } from '../state/mutate';
import { getBoard, getCardDef, getWorldbreaker } from '../state/query';
import { expireLastingEffects, runCleanup } from './cleanup';
import { resolveTriggeredAbilities } from '../abilities/triggers';

const ACTIONS_PER_ROUND = 8; // 4 per player, alternating

/**
 * After an action, advance turn/phase as needed.
 */
export function advanceTurn(state: GameState, events: GameEvent[]): { state: GameState; events: GameEvent[] } {
  let s = { ...state, actionsTaken: state.actionsTaken + 1 };
  const allEvents = [...events];

  if (s.actionsTaken >= ACTIONS_PER_ROUND) {
    // Transition to rally phase
    return enterRallyPhase(s, allEvents);
  }

  // Alternate active player
  const nextPlayer = s.activePlayer === s.firstPlayer
    ? opponentOf(s.firstPlayer)
    : s.firstPlayer;

  s = { ...s, activePlayer: nextPlayer };
  allEvents.push({ type: 'turn_changed', activePlayer: nextPlayer });

  // Expire end-of-turn lasting effects
  const expireResult = expireLastingEffects(s, 'end_of_turn');
  s = expireResult.state;
  allEvents.push(...expireResult.events);

  return { state: s, events: allEvents };
}

/**
 * Execute the full rally phase.
 */
export function enterRallyPhase(state: GameState, events: GameEvent[]): { state: GameState; events: GameEvent[] } {
  let s: GameState = { ...state, phase: 'rally' };
  const allEvents = [...events];
  allEvents.push({ type: 'phase_changed', phase: 'rally', round: s.round });

  // Step 1: Rally abilities (on both players' cards)
  for (const player of PLAYERS) {
    allEvents.push({ type: 'rally_step', step: 'rally_abilities', player });
    const triggerResult = resolveTriggeredAbilities(s, 'rally', player, {});
    s = triggerResult.state;
    allEvents.push(...triggerResult.events);
  }

  // Step 2: Ready all cards (handle stun)
  for (const player of PLAYERS) {
    allEvents.push({ type: 'rally_step', step: 'ready_all', player });
    const board = getBoard(s, player);
    for (const card of board) {
      const stunCount = getCounter(card.counters, 'stun');
      if (stunCount > 0) {
        // Remove a stun counter instead of readying
        const removeResult = removeCounterFromCard(s, card.instanceId, 'stun', 1);
        s = removeResult.state;
        allEvents.push(...removeResult.events);
      } else if (card.exhausted) {
        const readyResult = readyCard(s, card.instanceId);
        s = readyResult.state;
        allEvents.push(...readyResult.events);
      }
    }
    // Reset used abilities
    s = {
      ...s,
      cards: s.cards.map(c =>
        c.owner === player ? { ...c, usedAbilities: [] } : c
      ),
    };
  }

  // Step 3: Gain mythium (2 per player)
  for (const player of PLAYERS) {
    allEvents.push({ type: 'rally_step', step: 'gain_mythium', player });
    const mythResult = gainMythium(s, player, 2);
    s = mythResult.state;
    allEvents.push(...mythResult.events);
  }

  // Step 4: Draw a card (1 per player; if deck empty, opponent gains 1 power)
  for (const player of PLAYERS) {
    allEvents.push({ type: 'rally_step', step: 'draw_card', player });
    const hasDeck = s.cards.some(c => c.owner === player && c.zone === 'deck');
    if (hasDeck) {
      const drawResult = drawCard(s, player);
      s = drawResult.state;
      allEvents.push(...drawResult.events);
    } else {
      const opponent = opponentOf(player);
      const powerResult = gainPower(s, opponent, 1);
      s = powerResult.state;
      allEvents.push(...powerResult.events);
    }
  }

  // Step 5: Victory check
  const p1Power = s.players.player1.power;
  const p2Power = s.players.player2.power;

  if (p1Power >= 10 || p2Power >= 10) {
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
    allEvents.push({ type: 'game_over', winner: s.winner! });
    return { state: s, events: allEvents };
  }

  // Step 6: Change order + start new round
  const newFirstPlayer = opponentOf(s.firstPlayer);
  s = {
    ...s,
    phase: 'action',
    round: s.round + 1,
    actionsTaken: 0,
    firstPlayer: newFirstPlayer,
    activePlayer: newFirstPlayer,
  };

  // Expire end-of-round lasting effects
  const expireResult = expireLastingEffects(s, 'end_of_round');
  s = expireResult.state;
  allEvents.push(...expireResult.events);

  allEvents.push({ type: 'phase_changed', phase: 'action', round: s.round });
  allEvents.push({ type: 'turn_changed', activePlayer: s.activePlayer });

  return { state: s, events: allEvents };
}

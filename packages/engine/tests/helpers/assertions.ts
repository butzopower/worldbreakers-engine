import { expect } from 'vitest';
import { GameState, CardInstance } from '../../src/types/state.js';
import { PlayerId, Zone } from '../../src/types/core.js';
import { GameEvent } from '../../src/types/events.js';
import { getCounter } from '../../src/types/counters.js';
import { CounterType } from '../../src/types/counters.js';

export function expectCardInZone(state: GameState, instanceId: string, zone: Zone): void {
  const card = state.cards.find(c => c.instanceId === instanceId);
  expect(card, `Card ${instanceId} not found`).toBeDefined();
  expect(card!.zone).toBe(zone);
}

export function expectPlayerMythium(state: GameState, player: PlayerId, amount: number): void {
  expect(state.players[player].mythium).toBe(amount);
}

export function expectPlayerPower(state: GameState, player: PlayerId, amount: number): void {
  expect(state.players[player].power).toBe(amount);
}

export function expectHandSize(state: GameState, player: PlayerId, size: number): void {
  const handCards = state.cards.filter(c => c.owner === player && c.zone === 'hand');
  expect(handCards.length).toBe(size);
  expect(state.players[player].handSize).toBe(size);
}

export function expectCardCounter(state: GameState, instanceId: string, counter: CounterType, value: number): void {
  const card = state.cards.find(c => c.instanceId === instanceId);
  expect(card, `Card ${instanceId} not found`).toBeDefined();
  expect(getCounter(card!.counters, counter)).toBe(value);
}

export function expectEvent(events: GameEvent[], type: GameEvent['type']): GameEvent {
  const event = events.find(e => e.type === type);
  expect(event, `Expected event of type ${type}`).toBeDefined();
  return event!;
}

export function expectNoEvent(events: GameEvent[], type: GameEvent['type']): void {
  const event = events.find(e => e.type === type);
  expect(event, `Did not expect event of type ${type}`).toBeUndefined();
}

export function getCardOnBoard(state: GameState, player: PlayerId, definitionId: string): CardInstance | undefined {
  return state.cards.find(c => c.owner === player && c.zone === 'board' && c.definitionId === definitionId);
}

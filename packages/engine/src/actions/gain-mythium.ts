import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { gainMythium } from '../state/mutate';

export function handleGainMythium(state: GameState, player: PlayerId, amount: number): { state: GameState; events: GameEvent[] } {
  return gainMythium(state, player, amount);
}

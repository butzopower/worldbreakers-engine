import { PlayerId } from '../types/core.js';
import { GameState } from '../types/state.js';
import { GameEvent } from '../types/events.js';
import { gainMythium } from '../state/mutate.js';

export function handleGainMythium(state: GameState, player: PlayerId): { state: GameState; events: GameEvent[] } {
  return gainMythium(state, player, 1);
}

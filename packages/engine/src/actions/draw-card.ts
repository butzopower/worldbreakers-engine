import { PlayerId } from '../types/core.js';
import { GameState } from '../types/state.js';
import { GameEvent } from '../types/events.js';
import { drawCard } from '../state/mutate.js';

export function handleDrawCard(state: GameState, player: PlayerId): { state: GameState; events: GameEvent[] } {
  return drawCard(state, player);
}

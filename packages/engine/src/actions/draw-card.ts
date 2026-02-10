import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { drawCard } from '../state/mutate';

export function handleDrawCard(state: GameState, player: PlayerId): { state: GameState; events: GameEvent[] } {
  return drawCard(state, player);
}

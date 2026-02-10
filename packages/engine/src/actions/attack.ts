import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { initiateAttack } from '../combat/combat';

export function handleAttack(
  state: GameState,
  player: PlayerId,
  attackerIds: string[],
): { state: GameState; events: GameEvent[] } {
  return initiateAttack(state, player, attackerIds);
}

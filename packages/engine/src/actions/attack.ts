import { PlayerId } from '../types/core.js';
import { GameState } from '../types/state.js';
import { GameEvent } from '../types/events.js';
import { initiateAttack } from '../combat/combat.js';

export function handleAttack(
  state: GameState,
  player: PlayerId,
  attackerIds: string[],
): { state: GameState; events: GameEvent[] } {
  return initiateAttack(state, player, attackerIds);
}

import { PlayerId, StandingGuild } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { spendMythium, gainStanding } from '../state/mutate';

export function handleBuyStanding(
  state: GameState,
  player: PlayerId,
  guild: StandingGuild,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];

  // Spend 2 mythium
  const spendResult = spendMythium(state, player, 2);
  let s = spendResult.state;
  events.push(...spendResult.events);

  // Gain 1 standing in chosen guild
  const standingResult = gainStanding(s, player, guild, 1);
  s = standingResult.state;
  events.push(...standingResult.events);

  return { state: s, events };
}

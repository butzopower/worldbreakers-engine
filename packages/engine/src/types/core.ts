export const PLAYERS = ['player1', 'player2'] as const;
export type PlayerId = typeof PLAYERS[number];

export const STANDING_GUILDS = ['earth', 'moon', 'void', 'stars'] as const;
export type StandingGuild = typeof STANDING_GUILDS[number];
export type Guild = StandingGuild | 'neutral';

export type Phase = 'action' | 'rally' | 'gameOver';

export type Zone =
  | 'deck'
  | 'hand'
  | 'board'
  | 'discard'
  | 'removed'
  | 'worldbreaker';

export type CombatStep =
  | 'declare_attackers'
  | 'declare_blockers'
  | 'fight'
  | 'breach';

export type RallyStep =
  | 'rally_abilities'
  | 'ready_all'
  | 'gain_mythium'
  | 'draw_card'
  | 'victory_check'
  | 'change_order';

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'player1' ? 'player2' : 'player1';
}

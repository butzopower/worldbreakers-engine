import { PlayerId, Guild } from './core.js';

export type PlayerAction =
  | { type: 'gain_mythium' }
  | { type: 'draw_card' }
  | { type: 'buy_standing'; guild: Guild }
  | { type: 'play_card'; cardInstanceId: string }
  | { type: 'attack'; attackerIds: string[] }
  | { type: 'develop'; locationInstanceId: string }
  | { type: 'use_ability'; cardInstanceId: string; abilityIndex: number }
  | { type: 'declare_blockers'; assignments: Record<string, string> }
  | { type: 'pass_block' }
  | { type: 'choose_target'; targetInstanceId: string }
  | { type: 'choose_discard'; cardInstanceIds: string[] }
  | { type: 'damage_location'; locationInstanceId: string }
  | { type: 'skip_breach_damage' };

export interface ActionInput {
  player: PlayerId;
  action: PlayerAction;
}

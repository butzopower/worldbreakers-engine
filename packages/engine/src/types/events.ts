import { PlayerId, StandingGuild, Zone, Phase } from './core';
import { CounterType } from './counters';

export type GameEvent =
  | { type: 'game_started'; firstPlayer: PlayerId }
  | { type: 'phase_changed'; phase: Phase; round: number }
  | { type: 'turn_changed'; activePlayer: PlayerId }
  | { type: 'mythium_gained'; player: PlayerId; amount: number }
  | { type: 'card_drawn'; player: PlayerId; cardInstanceId: string }
  | { type: 'standing_gained'; player: PlayerId; guild: StandingGuild; amount: number }
  | { type: 'card_played'; player: PlayerId; cardInstanceId: string; definitionId: string }
  | { type: 'card_moved'; cardInstanceId: string; from: Zone; to: Zone }
  | { type: 'counter_added'; cardInstanceId: string; counter: CounterType; amount: number; newTotal: number }
  | { type: 'counter_removed'; cardInstanceId: string; counter: CounterType; amount: number; newTotal: number }
  | { type: 'card_exhausted'; cardInstanceId: string }
  | { type: 'card_readied'; cardInstanceId: string }
  | { type: 'mythium_spent'; player: PlayerId; amount: number }
  | { type: 'power_gained'; player: PlayerId; amount: number }
  | { type: 'combat_started'; attackingPlayer: PlayerId; attackerIds: string[] }
  | { type: 'blocker_declared'; defendingPlayer: PlayerId; blockerId: string; attackerId: string }
  | { type: 'fight_resolved' }
  | { type: 'card_defeated'; cardInstanceId: string }
  | { type: 'breach'; attackingPlayer: PlayerId; attackerIds: string[] }
  | { type: 'location_damaged'; locationInstanceId: string; amount: number }
  | { type: 'combat_ended' }
  | { type: 'ability_triggered'; cardInstanceId: string; abilityIndex: number; timing: string }
  | { type: 'location_developed'; locationInstanceId: string; stage: number }
  | { type: 'location_depleted'; locationInstanceId: string }
  | { type: 'card_discarded'; player: PlayerId; cardInstanceId: string }
  | { type: 'rally_step'; step: string; player: PlayerId }
  | { type: 'game_over'; winner: PlayerId | 'draw' }
  | { type: 'lasting_effect_created'; effectId: string; description: string }
  | { type: 'lasting_effect_expired'; effectId: string };

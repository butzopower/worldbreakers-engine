import { PlayerId, StandingGuild, Zone } from './core';
import { AbilityDefinition, AbilityTiming, CardFilter, EffectPrimitive, Mode } from './effects';
import { CombatResponseTrigger, LastingEffectExpiration, LastingEffectType, TriggerOption } from "./state";
import { ResolveContext } from "../abilities/primitives";
import { CounterType } from './counters';
import { CostDiscount } from './cards';

export type EngineStep =
  // Player Input
  | { type: 'request_choose_mode', player: PlayerId; sourceCardId: string; modes: Mode[] }
  | { type: 'request_choose_play_order'; player: PlayerId; cardInstanceIds: string[] }
  | { type: 'request_choose_discard', player: PlayerId; sourceCardId: string; count: number }
  | { type: 'request_choose_attackers', player: PlayerId; maxAttackers?: number }
  | { type: 'request_cost_discount'; player: PlayerId; cardInstanceId: string; costDiscount: CostDiscount; externalCostReduction: number }
  | { type: 'request_choose_target'; player: PlayerId; sourceCardId: string; abilityIndex: number; effects: EffectPrimitive[]; filter: CardFilter; triggeringCardId?: string }
  | { type: 'request_choose_reveal_for_opponent_discard'; player: PlayerId; count: number; choosingPlayer: PlayerId; sourceCardId: string }
  // Effect Resolution
  | { type: 'resolve_effects'; effects: EffectPrimitive[]; ctx: ResolveContext }
  | { type: 'resolve_ability_at_index'; controller: PlayerId; sourceCardId: string; abilityIndex: number; triggeringCardId?: string; costReduction?: number }
  | { type: 'resolve_ability'; controller: PlayerId; sourceCardId: string; ability: AbilityDefinition; triggeringCardId?: string; costReduction?: number }
  | { type: 'resolve_custom_ability'; controller: PlayerId; sourceCardId: string; customResolve: string; triggeringCardId?: string; costReduction?: number }
  // Cleanup & Triggers
  | { type: 'cleanup' }
  | { type: 'check_triggers'; timing: AbilityTiming; player: PlayerId; triggeringCardId?: string }
  | { type: 'order_triggers'; player: PlayerId; triggers: TriggerOption[] }
  | { type: 'check_combat_responses'; timing: CombatResponseTrigger }
  // Turn Structure
  | { type: 'advance_turn' }
  // Rally Phase
  | { type: 'rally_triggers'; player: PlayerId }
  | { type: 'rally_ready'; player: PlayerId }
  | { type: 'rally_mythium'; player: PlayerId }
  | { type: 'rally_draw'; player: PlayerId }
  | { type: 'rally_victory_check' }
  | { type: 'rally_new_round' }
  // Combat
  | { type: 'combat_start'; attackingPlayer: PlayerId; attackerIds: string[] }
  | { type: 'combat_declare_blockers'; defender: PlayerId; attackerIds: string[] }
  | { type: 'combat_fight'; attackerId: string; blockerId: string }
  | { type: 'combat_resolve_fight'; attackerId: string; blockerId: string }
  | { type: 'check_overwhelm_trigger'; attackerId: string }
  | { type: 'combat_post_block'; remainingAttackerIds: string[] }
  | { type: 'combat_breach'; livingAttackerIds: string[] }
  | { type: 'choose_breach_target', player: PlayerId; }
  | { type: 'combat_end' }
  // Locations
  | { type: 'develop'; player: PlayerId; locationId: string; }
  // Log
  | { type: 'reveal_cards', player: PlayerId; cardDefinitionIds: string[] }
  | { type: 'card_played'; player: PlayerId; cardInstanceId: string }
  | { type: 'location_developed'; locationInstanceId: string; stage: number }
  // Board State
  | { type: 'draw_card'; player: PlayerId }
  | { type: 'move_card', cardInstanceId: string; toZone: Zone }
  | { type: 'move_card_to_deck_bottom', cardInstanceId: string }
  | { type: 'shuffle_deck', player: PlayerId }
  | { type: 'add_counter'; cardInstanceId: string; counter: CounterType; amount: number }
  | { type: 'remove_counter'; cardInstanceId: string; counter: CounterType; amount: number }
  | { type: 'exhaust_card'; cardInstanceId: string }
  | { type: 'ready_card'; cardInstanceId: string }
  | { type: 'destroy_card'; cardInstanceId: string }
  | { type: 'spend_mythium'; player: PlayerId; amount: number }
  | { type: 'gain_mythium'; player: PlayerId; amount: number }
  | { type: 'lose_mythium'; player: PlayerId; amount: number }
  | { type: 'gain_power'; player: PlayerId; amount: number }
  | { type: 'lose_power'; player: PlayerId; amount: number }
  | { type: 'gain_standing'; player: PlayerId; guild: StandingGuild; amount: number }
  | { type: 'lose_standing'; player: PlayerId; guild: StandingGuild; amount: number }
  | { type: 'grant_lasting_effect'; effectType: LastingEffectType; amount: number; targetInstanceIds: string[]; expiresAt: LastingEffectExpiration }
  | { type: 'register_combat_response'; trigger: CombatResponseTrigger; effects: EffectPrimitive[]; controller: PlayerId; sourceCardId: string }
  | { type: 'grant_bonus_action'; player: PlayerId }
  | { type: 'remove_from_combat'; cardInstanceId: string }
  ;

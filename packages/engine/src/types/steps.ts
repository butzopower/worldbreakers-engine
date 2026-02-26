import { PlayerId } from './core';
import { AbilityTiming, EffectPrimitive, Mode } from './effects';
import { CombatResponseTrigger } from "./state";
import { ResolveContext } from "../abilities/primitives";

export type EngineStep =
  // Player Input
  | { type: 'request_choose_mode', player: PlayerId; sourceCardId: string; modes: Mode[] }
  | { type: 'request_choose_discard', player: PlayerId; sourceCardId: string; count: number }
  // Effect Resolution
  | { type: 'resolve_effects'; effects: EffectPrimitive[]; ctx: ResolveContext }
  | { type: 'resolve_ability'; controller: PlayerId; sourceCardId: string; abilityIndex: number; triggeringCardId?: string }
  | { type: 'resolve_custom_ability'; controller: PlayerId; sourceCardId: string; customResolve: string; triggeringCardId?: string }
  // Cleanup & Triggers
  | { type: 'cleanup' }
  | { type: 'check_triggers'; timing: AbilityTiming; player: PlayerId; triggeringCardId?: string }
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
  | { type: 'combat_declare_blockers'; defender: PlayerId; attackerIds: string[] }
  | { type: 'combat_post_block'; remainingAttackerIds: string[] }
  | { type: 'combat_breach'; livingAttackerIds: string[] }
  | { type: 'choose_breach_target', player: PlayerId; }
  | { type: 'combat_breach_complete' }
  | { type: 'combat_end' }
  // Board State
  | { type: 'gain_mythium'; player: PlayerId; amount: number }
  | { type: 'gain_power', player: PlayerId; amount: number }
  ;

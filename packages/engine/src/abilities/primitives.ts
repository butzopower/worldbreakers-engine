import { PlayerId, opponentOf, STANDING_GUILDS } from '../types/core';
import { GameState } from '../types/state';
import { EffectPrimitive, PlayerSelector, TargetSelector, Mode } from '../types/effects';
import { getCard, getFollowers, canDevelop, canAttack } from '../state/query';
import { EngineStep } from "../types/steps";
import { playCard } from "../engine/engine";
import { isConditionMet } from "./conditions";
import { matchesFilter } from "./matches-filter";

export interface ResolveContext {
  controller: PlayerId;
  sourceCardId: string;
  triggeringCardId?: string;
  /** Chosen targets (for 'choose' selectors) */
  chosenTargets?: string[];
  /** External cost reduction applied when this card was played (e.g. from Yam Operator) */
  costReduction?: number;
}

export function resolvePlayerSelector(selector: PlayerSelector, ctx: ResolveContext): PlayerId[] {
  switch (selector) {
    case 'self':
    case 'controller':
      return [ctx.controller];
    case 'opponent':
      return [opponentOf(ctx.controller)];
    case 'both':
      return ['player1', 'player2'];
    case 'active':
      return [ctx.controller]; // In most contexts this is the controller
  }
}

function resolveTargets(state: GameState, selector: TargetSelector, ctx: ResolveContext): string[] {
  switch (selector.kind) {
    case 'self':
      return [ctx.sourceCardId];
    case 'triggering_card':
      return ctx.triggeringCardId ? [ctx.triggeringCardId] : [];
    case 'source_card':
      return [ctx.sourceCardId];
    case 'all':
      return state.cards
        .filter(c => matchesFilter(state, c, selector.filter, ctx))
        .map(c => c.instanceId);
    case 'choose':
      // Use pre-chosen targets if available
      return ctx.chosenTargets ?? [];
  }
}

export function resolvePrimitive(
  state: GameState,
  effect: EffectPrimitive,
  ctx: ResolveContext,
): EngineStep[] {
  switch (effect.type) {
    case 'gain_mythium': {
      const players = resolvePlayerSelector(effect.player, ctx);
      return players.map(player => (
        {type: 'gain_mythium', player, amount: effect.amount}
      ));
    }
    case 'draw_cards': {
      const steps: EngineStep[] = [];
      const players = resolvePlayerSelector(effect.player, ctx);
      for (const p of players) {
        for (let i = 0; i < effect.count; i++) {
          steps.push({type: 'draw_card', player: p});
        }
      }
      return steps;
    }
    case 'gain_standing': {
      const guild = effect.guild;
      if (guild === 'choose') {
        const modes = STANDING_GUILDS.map(g => ({
          label: `Gain ${effect.amount} ${g.charAt(0).toUpperCase() + g.slice(1)} standing`,
          effects: [{type: 'gain_standing' as const, player: effect.player, guild: g, amount: effect.amount}],
        }));
        return [{type: 'request_choose_mode', player: ctx.controller, sourceCardId: ctx.sourceCardId, modes}];
      }
      const players = resolvePlayerSelector(effect.player, ctx);
      return players.map(player => (
        {type: 'gain_standing', player, guild, amount: effect.amount}
      ));
    }
    case 'gain_power': {
      const players = resolvePlayerSelector(effect.player, ctx);
      return players.map(player => (
        {type: 'gain_power', player, amount: effect.amount}
      ));
    }
    case 'deal_wounds': {
      const targets = resolveTargets(state, effect.target, ctx);
      return targets.map(targetId => (
        {type: 'add_counter', cardInstanceId: targetId, counter: 'wound', amount: effect.amount}
      ));
    }
    case 'add_counter': {
      const targets = resolveTargets(state, effect.target, ctx);
      return targets.map(targetId => (
        {type: 'add_counter', cardInstanceId: targetId, counter: effect.counter, amount: effect.amount}
      ))
    }
    case 'remove_counter': {
      const targets = resolveTargets(state, effect.target, ctx);
      return targets.map(targetId => (
        {type: 'remove_counter', cardInstanceId: targetId, counter: effect.counter, amount: effect.amount}
      ))
    }
    case 'discard': {
      function hasCardsInHand(player: PlayerId) {
        return state.cards.filter(c => c.owner === player && c.zone === 'hand').length > 0;
      }

      const players = resolvePlayerSelector(effect.player, ctx);
      return players.filter(hasCardsInHand).map(player => (
        {
          type: 'request_choose_discard',
          player,
          count: effect.count,
          sourceCardId: ctx.sourceCardId,
        }
      ))
    }
    case 'exhaust': {
      const targets = resolveTargets(state, effect.target, ctx);
      return targets.map(targetId => (
        {type: 'exhaust_card', cardInstanceId: targetId}
      ));
    }
    case 'ready': {
      const targets = resolveTargets(state, effect.target, ctx);
      return targets.map(targetId => (
        {type: 'ready_card', cardInstanceId: targetId}
      ));
    }
    case 'buff_attackers': {
      if (state.combat) {
        return [
          {
            type: 'grant_lasting_effect',
            effectType: effect.counter,
            amount: effect.amount,
            targetInstanceIds: [...state.combat.attackerIds],
            expiresAt: 'end_of_combat',
          }
        ]
      }
      return [];
    }
    case 'play_card': {
      const targets = resolveTargets(state, effect.target, ctx);
      if (targets.length === 1) {
        return playCard(state, ctx.controller, targets[0], {costReduction: effect.costReduction});
      }
      return [];
    }
    case 'destroy': {
      const targets = resolveTargets(state, effect.target, ctx);
      return targets.map(targetId => (
        {type: 'destroy_card', cardInstanceId: targetId}
      ));
    }
    case 'develop': {
      const steps: EngineStep[] = [];
      const targets = resolveTargets(state, effect.target, ctx);
      for (const targetId of targets) {
        const card = getCard(state, targetId);
        if (card && canDevelop(state, ctx.controller, card)) {
          steps.push({type: 'develop', player: ctx.controller, locationId: targetId});
        }
      }
      return steps;
    }
    case 'conditional': {
      const { condition, effects: innerEffects } = effect;
      const resolveCtx = {controller: ctx.controller, sourceCardId: ctx.sourceCardId, triggeringCardId: ctx.triggeringCardId};
      if (isConditionMet(state, condition, ctx)) {
        return [{ type: 'resolve_effects', effects: innerEffects, ctx: resolveCtx }];
      }
      if (effect.else) {
        return [{ type: 'resolve_effects', effects: effect.else, ctx: resolveCtx }];
      }
      return [];
    }
    case 'initiate_attack': {
      const attackable = getFollowers(state, ctx.controller).filter(f => canAttack(state, f));
      if (attackable.length > 0) {
        return [{type: 'request_choose_attackers', player: ctx.controller, maxAttackers: effect.maxAttackers}];
      }
      return [];
    }
    case 'on_successful_attack': {
      const attackable = getFollowers(state, ctx.controller).filter(f => canAttack(state, f));
      if (attackable.length === 0) return [];
      return [
        {
          type: 'register_combat_response',
          trigger: 'on_breach' as const,
          effects: effect.effects,
          controller: ctx.controller,
          sourceCardId: ctx.sourceCardId,
        },
        { type: 'request_choose_attackers', player: ctx.controller, maxAttackers: effect.maxAttackers },
      ];
    }
    case 'damage_location': {
      return [{ type: 'choose_breach_target', player: ctx.controller }];
    }
    case 'lose_standing': {
      const players = resolvePlayerSelector(effect.player, ctx);
      return players.map(player => (
        {type: 'lose_standing', player, guild: effect.guild, amount: effect.amount}
      ));
    }
    case 'lose_mythium': {
      const players = resolvePlayerSelector(effect.player, ctx);
      return players.map(player => (
        {type: 'lose_mythium', player, amount: effect.amount}
      ));
    }
    case 'lose_power': {
      const players = resolvePlayerSelector(effect.player, ctx);
      return players.map(player => (
        {type: 'lose_power', player, amount: effect.amount}
      ));
    }
    case 'grant_lasting_effect': {
      const targets = resolveTargets(state, effect.target, ctx);
      if (targets.length > 0) {
        return [
          {
            type: 'grant_lasting_effect',
            effectType: effect.effect,
            amount: effect.amount ?? 0,
            targetInstanceIds: targets,
            expiresAt: effect.expiresAt,
          }
        ];
      }
      return [];
    }
    case 'register_combat_response': {
      return [
        {
          type: 'register_combat_response',
          trigger: effect.trigger,
          effects: effect.effects,
          controller: ctx.controller,
          sourceCardId: ctx.sourceCardId,
        }
      ];
    }
    case 'migrate': {
      const controller = ctx.controller;
      const hasEarth = state.players[controller].standing.earth >= 1;

      const modes: Mode[] = [
        {
          label: 'Gain 1 Earth standing',
          effects: [{type: 'gain_standing', player: 'controller', guild: 'earth', amount: 1}],
        },
      ];

      if (hasEarth) {
        modes.push({
          label: 'Migrate',
          effects: [
            {type: 'lose_standing', player: 'controller', guild: 'earth', amount: 1},
            ...effect.effects,
          ],
        });
      }

      if (modes.length === 1) {
        return [{type: 'gain_standing', player: controller, guild: 'earth', amount: 1}]
      } else {
        return [{type: 'request_choose_mode', player: controller, sourceCardId: ctx.sourceCardId, modes}];
      }
    }
    case 'exhausts': {
      return [
        { type: 'exhaust_card', cardInstanceId: ctx.sourceCardId },
        {
          type: 'resolve_effects',
          effects: effect.effects,
          ctx: { controller: ctx.controller, sourceCardId: ctx.sourceCardId, triggeringCardId: ctx.triggeringCardId },
        },
      ];
    }
    case 'pays_mythium': {
      return [
        { type: 'spend_mythium', player: ctx.controller, amount: effect.amount },
        {
          type: 'resolve_effects',
          effects: effect.effects,
          ctx: { controller: ctx.controller, sourceCardId: ctx.sourceCardId, triggeringCardId: ctx.triggeringCardId },
        },
      ];
    }
    case 'custom_resolve': {
      return [
        {
          type: 'resolve_custom_ability',
          controller: ctx.controller,
          sourceCardId: ctx.sourceCardId,
          customResolve: effect.customResolve,
          triggeringCardId: ctx.triggeringCardId,
        },
      ];
    }
    case 'grant_bonus_action': {
      const players = resolvePlayerSelector(effect.player, ctx);
      return players.map(player => ({ type: 'grant_bonus_action' as const, player }));
    }
    case 'remove_from_combat': {
      const targets = resolveTargets(state, effect.target, ctx);
      return targets.map(cardInstanceId => ({ type: 'remove_from_combat' as const, cardInstanceId }));
    }
    case 'optional': {
      return [
        {
          type: 'request_choose_mode',
          player: ctx.controller,
          sourceCardId: ctx.sourceCardId,
          modes: [
            { label: effect.label, effects: effect.effects },
            { label: 'Pass', effects: [] },
          ],
        },
      ];
    }
    case 'choose_one': {
      return [
        {
          type: 'request_choose_mode',
          player: ctx.controller,
          sourceCardId: ctx.sourceCardId,
          modes: effect.modes,
        },
      ]
    }

  }

  return [];
}

/**
 * Find valid targets for a 'choose' selector.
 */
export function findValidTargets(state: GameState, selector: TargetSelector, ctx: ResolveContext): string[] {
  if (selector.kind !== 'choose') return [];
  return state.cards
    .filter(c => matchesFilter(state, c, selector.filter, ctx))
    .map(c => c.instanceId);
}

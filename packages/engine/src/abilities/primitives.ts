import { PlayerId, opponentOf, STANDING_GUILDS } from '../types/core';
import { GameState } from '../types/state';
import { EffectPrimitive, PlayerSelector, TargetSelector, CardFilter, Mode } from '../types/effects';
import { CardInstance } from '../types/state';
import { getCard, getCardDef, getFollowers, canPay, canDevelop, canAttack, hasKeyword } from '../state/query';
import { getCounter } from '../types/counters';
import { EngineStep } from "../types/steps";
import { playCard } from "../engine/engine";

export interface ResolveContext {
  controller: PlayerId;
  sourceCardId: string;
  triggeringCardId?: string;
  /** Chosen targets (for 'choose' selectors) */
  chosenTargets?: string[];
}

function resolvePlayerSelector(selector: PlayerSelector, ctx: ResolveContext): PlayerId[] {
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

function matchesFilter(state: GameState, card: CardInstance, filter: CardFilter, ctx: ResolveContext): boolean {
  const def = getCardDef(card);

  if (filter.type) {
    const types = Array.isArray(filter.type) ? filter.type : [filter.type];
    if (!types.includes(def.type)) return false;
  }
  if (filter.guild) {
    const guilds = Array.isArray(filter.guild) ? filter.guild : [filter.guild];
    if (!guilds.includes(def.guild)) return false;
  }
  if (filter.zone) {
    const zones = Array.isArray(filter.zone) ? filter.zone : [filter.zone];
    if (!zones.includes(card.zone)) return false;
  }
  if (filter.owner) {
    const owners = resolvePlayerSelector(filter.owner, ctx);
    if (!owners.includes(card.owner)) return false;
  }
  if (filter.excludeSelf && card.instanceId === ctx.sourceCardId) return false;
  if (filter.keyword && !hasKeyword(state, card, filter.keyword)) return false;
  if (filter.notKeyword && hasKeyword(state, card, filter.notKeyword)) return false;
  if (filter.maxCost !== undefined && def.cost > filter.maxCost) return false;
  if (filter.cardInstanceIds && !filter.cardInstanceIds.includes(card.instanceId)) return false;
  if (filter.canPay && !canPay(state, ctx.controller, card, {costReduction: filter.canPay.costReduction})) return false;
  if (filter.wounded !== undefined) {
    const wounds = getCounter(card.counters, 'wound');
    if (filter.wounded && wounds <= 0) return false;
    if (!filter.wounded && wounds > 0) return false;
  }

  return true;
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
      const {condition, effects: innerEffects} = effect;
      let conditionMet = false;
      if (condition.type === 'min_card_count') {
        const matching = state.cards.filter(c => matchesFilter(state, c, condition.filter, ctx));
        conditionMet = matching.length >= condition.count;
      } else if (condition.type === 'attacking_alone') {
        conditionMet = state.combat !== null && state.combat.attackerIds.length === 1;
      } else if (condition.type === 'standing_less_than') {
        conditionMet = state.players[ctx.controller].standing[condition.guild] < condition.amount;
      } else if (condition.type === 'any_standing_at_least') {
        conditionMet = STANDING_GUILDS.some(g => state.players[ctx.controller].standing[g] >= condition.amount);
      } else if (condition.type === 'follower_defeated_this_round') {
        conditionMet = state.defeatedThisRound.length > 0;
      }
      if (conditionMet) {
        return [
          {
            type: 'resolve_effects',
            effects: innerEffects,
            ctx: {controller: ctx.controller, sourceCardId: ctx.sourceCardId, triggeringCardId: ctx.triggeringCardId},
          }
        ]
      }
      return [];
    }
    case 'initiate_attack': {
      const attackable = getFollowers(state, ctx.controller).filter(f => canAttack(state, f));
      if (attackable.length > 0) {
        return [{type: 'request_choose_attackers', player: ctx.controller}];
      }
      return [];
    }
    case 'lose_standing': {
      const players = resolvePlayerSelector(effect.player, ctx);
      return players.map(player => (
        {type: 'lose_standing', player, guild: effect.guild, amount: effect.amount}
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

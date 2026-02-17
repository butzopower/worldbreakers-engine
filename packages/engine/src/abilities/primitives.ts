import { PlayerId, opponentOf, STANDING_GUILDS } from '../types/core';
import { GameState, LastingEffect } from '../types/state';
import { GameEvent } from '../types/events';
import { EffectPrimitive, PlayerSelector, TargetSelector, CardFilter } from '../types/effects';
import { CardInstance } from '../types/state';
import {
  gainMythium, drawCard, gainStanding, loseStanding, gainPower, addCounterToCard,
  removeCounterFromCard, exhaustCard, readyCard, moveCard, addLastingEffect,
} from '../state/mutate';
import { getCard, getCardDef, getBoard, getFollowers, canPay, canDevelop, canAttack } from '../state/query';
import { handleDevelop } from '../actions/develop';
import { generateEffectId } from '../utils/id';
import { handlePlayCard } from "../actions/play-card";

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
  if (filter.canPay && !canPay(state, ctx.controller, card, { costReduction: filter.canPay.costReduction })) return false;

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
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];

  switch (effect.type) {
    case 'gain_mythium': {
      const players = resolvePlayerSelector(effect.player, ctx);
      for (const p of players) {
        const r = gainMythium(s, p, effect.amount);
        s = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'draw_cards': {
      const players = resolvePlayerSelector(effect.player, ctx);
      for (const p of players) {
        for (let i = 0; i < effect.count; i++) {
          const r = drawCard(s, p);
          s = r.state;
          events.push(...r.events);
        }
      }
      break;
    }
    case 'gain_standing': {
      if (effect.guild === 'choose') {
        const player = resolvePlayerSelector(effect.player, ctx)[0];
        s = {
          ...s,
          pendingChoice: {
            type: 'choose_mode',
            playerId: player,
            sourceCardId: ctx.sourceCardId,
            modes: STANDING_GUILDS.map(g => ({
              label: `Gain ${effect.amount} ${g.charAt(0).toUpperCase() + g.slice(1)} standing`,
              effects: [{ type: 'gain_standing' as const, player: effect.player, guild: g, amount: effect.amount }],
            })),
          },
        };
        break;
      }
      const players = resolvePlayerSelector(effect.player, ctx);
      for (const p of players) {
        const r = gainStanding(s, p, effect.guild, effect.amount);
        s = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'gain_power': {
      const players = resolvePlayerSelector(effect.player, ctx);
      for (const p of players) {
        const r = gainPower(s, p, effect.amount);
        s = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'deal_wounds': {
      const targets = resolveTargets(s, effect.target, ctx);
      for (const targetId of targets) {
        const r = addCounterToCard(s, targetId, 'wound', effect.amount);
        s = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'add_counter': {
      const targets = resolveTargets(s, effect.target, ctx);
      for (const targetId of targets) {
        const r = addCounterToCard(s, targetId, effect.counter, effect.amount);
        s = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'remove_counter': {
      const targets = resolveTargets(s, effect.target, ctx);
      for (const targetId of targets) {
        const r = removeCounterFromCard(s, targetId, effect.counter, effect.amount);
        s = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'discard': {
      // This creates a pending choice for the player to choose cards to discard
      const players = resolvePlayerSelector(effect.player, ctx);
      for (const p of players) {
        // If there's a pending choice system, we'd set it here
        // For now, if no cards in hand, skip
        const hand = s.cards.filter(c => c.owner === p && c.zone === 'hand');
        if (hand.length === 0) continue;

        // Set pending choice for discard
        s = {
          ...s,
          pendingChoice: {
            type: 'choose_discard',
            playerId: p,
            count: effect.count,
            sourceCardId: ctx.sourceCardId,
          },
        };
        // Only one pending choice at a time - break after first
        break;
      }
      break;
    }
    case 'exhaust': {
      const targets = resolveTargets(s, effect.target, ctx);
      for (const targetId of targets) {
        const r = exhaustCard(s, targetId);
        s = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'ready': {
      const targets = resolveTargets(s, effect.target, ctx);
      for (const targetId of targets) {
        const r = readyCard(s, targetId);
        s = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'buff_attackers': {
      // Apply to all attackers in current combat
      if (s.combat) {
        const effectId = generateEffectId();
        const lastingEffect: LastingEffect = {
          id: effectId,
          type: effect.counter,
          amount: effect.amount,
          targetInstanceIds: [...s.combat.attackerIds],
          expiresAt: 'end_of_combat',
        };
        const r = addLastingEffect(s, lastingEffect);
        s = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'play_card': {
      const targets = resolveTargets(s, effect.target, ctx);

      if (targets.length === 1) {
        const r = handlePlayCard(s, ctx.controller, targets[0], {costReduction: effect.costReduction});
        s = r.state;
        events.push(...r.events);
      }

      break;
    }
    case 'develop': {
      const targets = resolveTargets(s, effect.target, ctx);
      for (const targetId of targets) {
        const card = getCard(s, targetId);
        if (card && canDevelop(s, ctx.controller, card)) {
          const r = handleDevelop(s, ctx.controller, targetId);
          s = r.state;
          events.push(...r.events);
        }
      }
      break;
    }
    case 'conditional': {
      const { condition, effects: innerEffects } = effect;
      let conditionMet = false;
      if (condition.type === 'min_card_count') {
        const matching = s.cards.filter(c => matchesFilter(s, c, condition.filter, ctx));
        conditionMet = matching.length >= condition.count;
      } else if (condition.type === 'attacking_alone') {
        conditionMet = s.combat !== null && s.combat.attackerIds.length === 1;
      } else if (condition.type === 'standing_less_than') {
        conditionMet = s.players[ctx.controller].standing[condition.guild] < condition.amount;
      }
      if (conditionMet) {
        for (const inner of innerEffects) {
          const r = resolvePrimitive(s, inner, ctx);
          s = r.state;
          events.push(...r.events);
        }
      }
      break;
    }
    case 'initiate_attack': {
      const attackable = getFollowers(s, ctx.controller).filter(f => canAttack(s, f));
      if (attackable.length > 0) {
        s = {
          ...s,
          pendingChoice: {
            type: 'choose_attackers',
            playerId: ctx.controller,
          },
        };
      }
      break;
    }
    case 'lose_standing': {
      const players = resolvePlayerSelector(effect.player, ctx);
      for (const p of players) {
        const r = loseStanding(s, p, effect.guild, effect.amount);
        s = r.state;
        events.push(...r.events);
      }
      break;
    }
    case 'migrate': {
      const controller = ctx.controller;
      const hasEarth = s.players[controller].standing.earth >= 1;

      const modes: { label: string; effects: EffectPrimitive[] }[] = [
        {
          label: 'Gain 1 Earth standing',
          effects: [{ type: 'gain_standing', player: 'controller', guild: 'earth', amount: 1 }],
        },
      ];

      if (hasEarth) {
        modes.push({
          label: 'Migrate',
          effects: [
            { type: 'lose_standing', player: 'controller', guild: 'earth', amount: 1 },
            ...effect.effects,
          ],
        });
      }

      if (modes.length === 1) {
        // Only one option - auto-resolve gain standing
        const r = gainStanding(s, controller, 'earth', 1);
        s = r.state;
        events.push(...r.events);
      } else {
        s = {
          ...s,
          pendingChoice: {
            type: 'choose_mode',
            playerId: controller,
            sourceCardId: ctx.sourceCardId,
            modes,
          },
        };
      }
      break;
    }
  }

  return { state: s, events };
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

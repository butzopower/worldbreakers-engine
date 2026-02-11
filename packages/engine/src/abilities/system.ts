import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { ResolveContext } from './primitives';
import { gainPower, drawCard, moveCard, spendMythium } from '../state/mutate';
import { getCard, getHand, getCardDef, meetsStandingRequirement } from '../state/query';
import { resolveAbility } from './resolver';
import { runCleanup } from '../engine/cleanup';
import { opponentOf } from '../types/core';

export type CustomResolverFn = (
  state: GameState,
  ctx: ResolveContext,
) => { state: GameState; events: GameEvent[] };

const customResolvers = new Map<string, CustomResolverFn>();

export function registerCustomResolver(key: string, fn: CustomResolverFn): void {
  customResolvers.set(key, fn);
}

export function getCustomResolver(key: string): CustomResolverFn | undefined {
  return customResolvers.get(key);
}

export type ChoiceResolverFn = (
  state: GameState,
  playerId: PlayerId,
  chosenCardInstanceId: string,
  choiceData: Record<string, unknown>,
) => { state: GameState; events: GameEvent[] };

const choiceResolvers = new Map<string, ChoiceResolverFn>();

export function registerChoiceResolver(key: string, fn: ChoiceResolverFn): void {
  choiceResolvers.set(key, fn);
}

export function getChoiceResolver(key: string): ChoiceResolverFn | undefined {
  return choiceResolvers.get(key);
}

// Register built-in custom resolvers

// Void Rift: Each player discards 1. Gain 1 power.
registerCustomResolver('void_rift', (state: GameState, ctx: ResolveContext) => {
  let s = state;
  const events: GameEvent[] = [];
  const opponent = opponentOf(ctx.controller);

  // Check if opponent has cards to discard
  const opponentHand = getHand(s, opponent);
  if (opponentHand.length > 0) {
    // Set pending choice for opponent to discard first
    s = {
      ...s,
      pendingChoice: {
        type: 'choose_discard',
        playerId: opponent,
        count: 1,
        sourceCardId: ctx.sourceCardId,
        phase: 'opponent_discard',
        nextPhase: 'controller_discard',
      },
    };
    return { state: s, events };
  }

  // If opponent has no cards, check controller
  const controllerHand = getHand(s, ctx.controller);
  if (controllerHand.length > 0) {
    s = {
      ...s,
      pendingChoice: {
        type: 'choose_discard',
        playerId: ctx.controller,
        count: 1,
        sourceCardId: ctx.sourceCardId,
        phase: 'controller_discard',
        nextPhase: 'gain_power',
      },
    };
    return { state: s, events };
  }

  // No one has cards - just gain power
  const powerResult = gainPower(s, ctx.controller, 1);
  return { state: powerResult.state, events: [...events, ...powerResult.events] };
});

// Gratuitous Gift: Play a follower card, paying 2 mythium less.
registerCustomResolver('gratuitous_gift', (state: GameState, ctx: ResolveContext) => {
  const costReduction = 2;
  const hand = getHand(state, ctx.controller);
  const playerState = state.players[ctx.controller];

  const validFollowers = hand.filter(card => {
    const def = getCardDef(card);
    if (def.type !== 'follower') return false;
    const reducedCost = Math.max(0, def.cost - costReduction);
    if (playerState.mythium < reducedCost) return false;
    if (def.standingRequirement && !meetsStandingRequirement(state, ctx.controller, def.standingRequirement)) return false;
    return true;
  });

  if (validFollowers.length === 0) {
    return { state, events: [] };
  }

  return {
    state: {
      ...state,
      pendingChoice: {
        type: 'choose_card',
        playerId: ctx.controller,
        sourceCardId: ctx.sourceCardId,
        filter: { type: 'follower', zone: ['hand'], owner: 'controller' },
        resolve: 'gratuitous_gift_play',
        costReduction,
      },
    },
    events: [],
  };
});

// Choice resolver: play the chosen follower at reduced cost
registerChoiceResolver('gratuitous_gift_play', (state, playerId, chosenCardInstanceId, choiceData) => {
  let s = state;
  const events: GameEvent[] = [];
  const chosenCard = getCard(s, chosenCardInstanceId)!;
  const chosenDef = getCardDef(chosenCard);
  const costReduction = (choiceData.costReduction as number) ?? 0;
  const reducedCost = Math.max(0, chosenDef.cost - costReduction);

  // Pay the reduced cost
  if (reducedCost > 0) {
    const payResult = spendMythium(s, playerId, reducedCost);
    s = payResult.state;
    events.push(...payResult.events);
  }

  // Play the follower to board
  const moveResult = moveCard(s, chosenCardInstanceId, 'board');
  s = moveResult.state;
  events.push(...moveResult.events);
  events.push({ type: 'card_played', player: playerId, cardInstanceId: chosenCardInstanceId, definitionId: chosenDef.id });

  // Resolve enters abilities
  if (chosenDef.abilities) {
    for (let i = 0; i < chosenDef.abilities.length; i++) {
      const ability = chosenDef.abilities[i];
      if (ability.timing === 'enters') {
        const abilityResult = resolveAbility(s, playerId, chosenCardInstanceId, ability, i);
        s = abilityResult.state;
        events.push(...abilityResult.events);
      }
    }
  }

  // Run cleanup
  const cleanupResult = runCleanup(s);
  s = cleanupResult.state;
  events.push(...cleanupResult.events);

  return { state: s, events };
});

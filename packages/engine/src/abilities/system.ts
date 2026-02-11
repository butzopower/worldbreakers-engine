import { PlayerId } from '../types/core';
import { GameState } from '../types/state';
import { GameEvent } from '../types/events';
import { ResolveContext } from './primitives';
import { gainPower, } from '../state/mutate';
import { getHand, getCardDef, canPay } from '../state/query';
import { handlePlayCard } from '../actions/play-card';
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
  const player = ctx.controller;
  const hand = getHand(state, player);

  const validFollowers = hand.filter(card => {
    return getCardDef(card).type === 'follower' && canPay(state, player, card, { costReduction });
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
  const costReduction = (choiceData.costReduction as number) ?? 0;
  return handlePlayCard(state, playerId, chosenCardInstanceId, { costReduction });
});

import { PlayerId } from '../types/core.js';
import { GameState } from '../types/state.js';
import { GameEvent } from '../types/events.js';
import { ResolveContext } from './primitives.js';
import { gainPower, drawCard, moveCard } from '../state/mutate.js';
import { getHand } from '../state/query.js';
import { opponentOf } from '../types/core.js';

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

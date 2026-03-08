import { GameState } from "../types/state";
import { Condition } from "../types/effects";
import { ResolveContext } from "./primitives";
import { STANDING_GUILDS } from "../types/core";
import { matchesFilter } from "./matches-filter";

export function isConditionMet(state: GameState, condition: Condition, ctx: ResolveContext): boolean {
  switch (condition.type) {
    case 'min_card_count':
      const matching = state.cards.filter(c => matchesFilter(state, c, condition.filter, ctx));
      return matching.length >= condition.count;
    case 'attacking_alone':
      return state.combat !== null && state.combat.attackerIds.length === 1;
    case 'standing_less_than':
      return state.players[ctx.controller].standing[condition.guild] < condition.amount;
    case 'any_standing_at_least':
      return STANDING_GUILDS.some(g => state.players[ctx.controller].standing[g] >= condition.amount);
    case 'follower_defeated_this_round':
      return state.defeatedThisRound.length > 0;
    case 'is_first_defeat_this_round':
      return ctx.triggeringCardId === state.defeatedThisRound[0];
  }
}
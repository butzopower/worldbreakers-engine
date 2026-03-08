import { CardInstance, GameState } from "../types/state";
import { CardFilter } from "../types/effects";
import { ResolveContext, resolvePlayerSelector } from "./primitives";
import { canPay, getCardDef, hasKeyword } from "../state/query";
import { getCounter } from "../types/counters";

export function matchesFilter(state: GameState, card: CardInstance, filter: CardFilter, ctx: ResolveContext): boolean {
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
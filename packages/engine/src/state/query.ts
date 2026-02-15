import {PlayerId, StandingGuild, Zone, opponentOf} from '../types/core';
import {GameState, CardInstance} from '../types/state';
import {CardDefinition, Keyword} from '../types/cards';
import {getCounter} from '../types/counters';
import {getCardDefinition} from '../cards/registry';

export function getCard(state: GameState, instanceId: string): CardInstance | undefined {
  return state.cards.find(c => c.instanceId === instanceId);
}

export function getCardDef(card: CardInstance): CardDefinition {
  return getCardDefinition(card.definitionId);
}

export function getCardsInZone(state: GameState, player: PlayerId, zone: Zone): CardInstance[] {
  return state.cards.filter(c => c.owner === player && c.zone === zone);
}

export function getBoard(state: GameState, player: PlayerId): CardInstance[] {
  return getCardsInZone(state, player, 'board');
}

export function getHand(state: GameState, player: PlayerId): CardInstance[] {
  return getCardsInZone(state, player, 'hand');
}

export function getDeck(state: GameState, player: PlayerId): CardInstance[] {
  return getCardsInZone(state, player, 'deck');
}

export function getWorldbreaker(state: GameState, player: PlayerId): CardInstance | undefined {
  return state.cards.find(c => c.owner === player && c.zone === 'worldbreaker');
}

export function getFollowers(state: GameState, player: PlayerId): CardInstance[] {
  return getBoard(state, player).filter(c => getCardDef(c).type === 'follower');
}

export function getLocations(state: GameState, player: PlayerId): CardInstance[] {
  return getBoard(state, player).filter(c => getCardDef(c).type === 'location');
}

export function getBaseStrength(card: CardInstance): number {
  const def = getCardDef(card);
  return def.strength ?? 0;
}

export function getBaseHealth(card: CardInstance): number {
  const def = getCardDef(card);
  return def.health ?? 0;
}

export function getEffectiveStrength(state: GameState, card: CardInstance): number {
  let str = getBaseStrength(card);
  // Add strength buff counters
  str += getCounter(card.counters, 'strength_buff');
  // Add lasting effects
  for (const effect of state.lastingEffects) {
    if (effect.type === 'strength_buff' && effect.targetInstanceIds.includes(card.instanceId)) {
      str += effect.amount;
    }
  }
  return Math.max(0, str);
}

export function getEffectiveHealth(card: CardInstance): number {
  const base = getBaseHealth(card);
  const wounds = getCounter(card.counters, 'wound');
  const buff = getCounter(card.counters, 'health_buff');
  return Math.max(0, base + buff - wounds);
}

export function isDefeated(card: CardInstance): boolean {
  const def = getCardDef(card);
  if (def.type !== 'follower') return false;
  const wounds = getCounter(card.counters, 'wound');
  return wounds >= (def.health ?? 0);
}

export function hasKeyword(state: GameState, card: CardInstance, keyword: Keyword): boolean {
  const def = getCardDef(card);
  if (def.keywords?.includes(keyword)) return true;
  if (def.conditionalKeywords) {
    for (const ck of def.conditionalKeywords) {
      if (ck.keyword !== keyword) continue;
      const owner = card.owner;
      const { condition } = ck;
      if (condition.type === 'standing_less_than') {
        if (state.players[owner].standing[condition.guild] < condition.amount) return true;
      }
    }
  }
  return false;
}

export function canAttack(state: GameState, card: CardInstance): boolean {
  if (card.zone !== 'board') return false;
  if (card.exhausted) return false;
  if (getCardDef(card).type !== 'follower') return false;
  if (hasKeyword(state, card, 'stationary')) return false;
  if (getCounter(card.counters, 'stun') > 0) return false;
  return true;
}

export function canBlock(state: GameState, card: CardInstance): boolean {
  if (card.zone !== 'board') return false;
  if (card.exhausted) return false;
  if (getCardDef(card).type !== 'follower') return false;
  if (getCounter(card.counters, 'stun') > 0) return false;
  return true;
}

export function isLocationDepleted(card: CardInstance): boolean {
  const def = getCardDef(card);
  if (def.type !== 'location') return false;
  return getCounter(card.counters, 'stage') <= 0;
}

export function getLocationStage(card: CardInstance): number {
  const def = getCardDef(card);
  if (def.type !== 'location' || !def.stages) return 0;
  const remaining = getCounter(card.counters, 'stage');
  return def.stages - remaining + 1;
}

export function canPay(
  state: GameState,
  player: PlayerId,
  card: CardInstance,
  opts?: { costReduction?: number },
): boolean {
  if (card.owner !== player) return false;

  const def = getCardDef(card);
  const playerState = state.players[player];

  const mythiumCost = Math.max(0, def.cost - (opts?.costReduction ?? 0));

  // Check mythium cost
  if (playerState.mythium < mythiumCost) return false;

  // Check standing requirement
  if (def.standingRequirement) {
    for (const [guild, required] of Object.entries(def.standingRequirement)) {
      if ((playerState.standing[guild as StandingGuild] ?? 0) < (required ?? 0)) {
        return false;
      }
    }
  }

  return true;
}


export function canPlayCard(state: GameState, player: PlayerId, card: CardInstance): boolean {
  if (card.zone !== 'hand') return false;
  if (card.owner !== player) return false;

  return canPay(state, player, card);
}

export function canDevelop(state: GameState, player: PlayerId, card: CardInstance): boolean {
  if (card.zone !== 'board') return false;
  if (card.owner !== player) return false;
  if (getCardDef(card).type !== 'location') return false;
  if (getCounter(card.counters, 'stage') <= 0) return false;
  return true;
}

export function canUseAbility(state: GameState, player: PlayerId, card: CardInstance, abilityIndex: number): boolean {
  if (card.zone !== 'board' && card.zone !== 'worldbreaker') return false;
  if (card.owner !== player) return false;

  const def = getCardDef(card);
  const abilities = def.abilities ?? [];
  if (abilityIndex >= abilities.length) return false;

  const ability = abilities[abilityIndex];
  if (ability.timing !== 'action') return false;
  if (card.usedAbilities.includes(abilityIndex)) return false;

  // Action abilities on followers require exhausting (not already exhausted)
  if (def.type === 'follower' && card.exhausted) return false;

  return true;
}

export function meetsStandingRequirement(
  state: GameState,
  player: PlayerId,
  requirement: Partial<Record<StandingGuild, number>>,
): boolean {
  const standing = state.players[player].standing;
  for (const [guild, required] of Object.entries(requirement)) {
    if ((standing[guild as StandingGuild] ?? 0) < (required ?? 0)) {
      return false;
    }
  }
  return true;
}

export function isHidden(state: GameState, card: CardInstance): boolean {
  return hasKeyword(state, card, 'hidden');
}

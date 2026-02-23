import { PlayerId, StandingGuild, Zone } from '../types/core';
import { CardInstance, GameState } from '../types/state';
import { CardDefinition, Keyword } from '../types/cards';
import { getCounter } from '../types/counters';
import { getCardDefinition } from '../cards/registry';

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
  str += getCounter(card.counters, 'plus_one_plus_one');
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
  const buff = getCounter(card.counters, 'plus_one_plus_one');
  return Math.max(0, base + buff - wounds);
}

export function isDefeated(card: CardInstance): boolean {
  return card.markAsDestroyed || getEffectiveHealth(card) <= 0;
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
  for (const effect of state.lastingEffects) {
    if (effect.type === keyword && effect.targetInstanceIds.includes(card.instanceId)) return true;
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

export function canBlockAttacker(state: GameState, blocker: CardInstance, attackerId: string): boolean {
  if (!canBlock(state, blocker)) return false;
  const attacker = getCard(state, attackerId);
  if (!attacker) return false;

  // Unblockable lasting effect
  for (const effect of state.lastingEffects) {
    if (effect.type === 'unblockable' && effect.targetInstanceIds.includes(attackerId)) return false;
  }

  // Static block restrictions on attacker
  const attackerDef = getCardDef(attacker);
  if (attackerDef.blockRestrictions) {
    for (const r of attackerDef.blockRestrictions) {
      if (r.type === 'wounded_blocker' && getCounter(blocker.counters, 'wound') > 0) return false;
      if (r.type === 'min_blocker_strength' && getEffectiveStrength(state, blocker) >= r.value) return false;
    }
  }

  // Intimidate from co-attackers
  if (state.combat) {
    const attackerStr = getEffectiveStrength(state, attacker);
    for (const otherId of state.combat.attackerIds) {
      if (otherId === attackerId) continue;
      const other = getCard(state, otherId);
      if (!other || other.zone !== 'board') continue;
      const otherDef = getCardDef(other);
      if (otherDef.passiveEffects?.some(p => p.type === 'intimidate')) {
        if (attackerStr < getEffectiveStrength(state, other)) return false;
      }
    }
  }

  return true;
}

export function isLocationDepleted(card: CardInstance): boolean {
  return card.markAsDestroyed || getCounter(card.counters, 'stage') <= 0;
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


export function getPassiveCostReduction(state: GameState, player: PlayerId, def: CardDefinition): number {
  let reduction = 0;
  for (const card of getBoard(state, player)) {
    const boardDef = getCardDef(card);
    if (boardDef.passiveEffects) {
      for (const passive of boardDef.passiveEffects) {
        if (passive.type === 'cost_reduction' && passive.cardTypes.includes(def.type)) {
          reduction += passive.amount;
        }
      }
    }
  }
  return reduction;
}

export function canPlayCard(state: GameState, player: PlayerId, card: CardInstance): boolean {
  if (card.zone !== 'hand') return false;
  if (card.owner !== player) return false;

  const def = getCardDef(card);
  const passiveReduction = getPassiveCostReduction(state, player, def);
  return canPay(state, player, card, { costReduction: passiveReduction });
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

export function isFollower(card: CardInstance): boolean {
  return getCardDef(card).type === 'follower'
}

export function hasLethal(state: GameState, card: CardInstance): boolean {
  if (hasKeyword(state, card, 'lethal')) return true;
  for (const effect of state.lastingEffects) {
    if (effect.type === 'lethal' && effect.targetInstanceIds.includes(card.instanceId)) {
      return true;
    }
  }
  return false;
}

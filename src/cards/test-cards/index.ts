import { CardDefinition } from '../../types/cards.js';
import { registerCard } from '../registry.js';

const testCards: CardDefinition[] = [
  // Worldbreakers
  {
    id: 'stone_sentinel',
    name: 'Stone Sentinel',
    type: 'worldbreaker',
    guild: 'earth',
    cost: 0,
    abilities: [{
      timing: 'your_attack',
      effects: [{ type: 'buff_attackers', counter: 'strength_buff', amount: 1 }],
      description: 'Your Attack: Your attackers get +1 strength this combat.',
    }],
  },
  {
    id: 'void_oracle',
    name: 'Void Oracle',
    type: 'worldbreaker',
    guild: 'void',
    cost: 0,
    abilities: [{
      timing: 'your_attack',
      effects: [{ type: 'draw_cards', player: 'self', count: 1 }],
      description: 'Your Attack: Draw 1 card.',
    }],
  },

  // Followers
  {
    id: 'militia_scout',
    name: 'Militia Scout',
    type: 'follower',
    guild: 'earth',
    cost: 1,
    strength: 1,
    health: 1,
  },
  {
    id: 'shield_bearer',
    name: 'Shield Bearer',
    type: 'follower',
    guild: 'earth',
    cost: 2,
    strength: 1,
    health: 3,
    keywords: ['stationary'],
  },
  {
    id: 'night_raider',
    name: 'Night Raider',
    type: 'follower',
    guild: 'moon',
    cost: 2,
    strength: 2,
    health: 1,
    keywords: ['bloodshed'],
    bloodshedAmount: 1,
  },
  {
    id: 'void_channeler',
    name: 'Void Channeler',
    type: 'follower',
    guild: 'void',
    cost: 3,
    strength: 1,
    health: 2,
    abilities: [{
      timing: 'action',
      effects: [{ type: 'gain_power', player: 'self', amount: 1 }],
      description: 'Action: Gain 1 power.',
    }],
  },
  {
    id: 'star_warden',
    name: 'Star Warden',
    type: 'follower',
    guild: 'stars',
    cost: 3,
    strength: 2,
    health: 2,
    keywords: ['overwhelm'],
  },
  {
    id: 'earthshaker_giant',
    name: 'Earthshaker Giant',
    type: 'follower',
    guild: 'earth',
    cost: 5,
    strength: 3,
    health: 4,
    standingRequirement: { earth: 2 },
    abilities: [{
      timing: 'enters',
      effects: [{ type: 'deal_wounds', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'] }, count: 1 }, amount: 1 }],
      description: 'Enters: Deal 1 wound to target follower.',
    }],
  },

  // Events
  {
    id: 'sudden_strike',
    name: 'Sudden Strike',
    type: 'event',
    guild: 'earth',
    cost: 1,
    abilities: [{
      timing: 'enters',
      effects: [{ type: 'deal_wounds', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'] }, count: 1 }, amount: 2 }],
      description: 'Deal 2 wounds to target follower.',
    }],
  },
  {
    id: 'void_rift',
    name: 'Void Rift',
    type: 'event',
    guild: 'void',
    cost: 3,
    abilities: [{
      timing: 'enters',
      customResolve: 'void_rift',
      description: 'Each player discards 1 card. Gain 1 power.',
    }],
  },

  // Locations
  {
    id: 'watchtower',
    name: 'Watchtower',
    type: 'location',
    guild: 'earth',
    cost: 2,
    stages: 3,
    locationStages: [
      { stage: 1, ability: { timing: 'enters', effects: [{ type: 'gain_mythium', player: 'self', amount: 1 }], description: 'Gain 1 mythium.' } },
      { stage: 2, ability: { timing: 'enters', effects: [{ type: 'draw_cards', player: 'self', count: 1 }], description: 'Draw 1 card.' } },
      { stage: 3, ability: { timing: 'enters', effects: [{ type: 'gain_power', player: 'self', amount: 1 }], description: 'Gain 1 power.' } },
    ],
  },
  {
    id: 'void_nexus',
    name: 'Void Nexus',
    type: 'location',
    guild: 'void',
    cost: 3,
    stages: 2,
    keywords: ['hidden'],
    locationStages: [
      { stage: 1, ability: { timing: 'enters', effects: [{ type: 'gain_standing', player: 'self', guild: 'void', amount: 1 }], description: 'Gain 1 void standing.' } },
      { stage: 2, ability: { timing: 'enters', effects: [{ type: 'deal_wounds', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'] }, count: 1 }, amount: 2 }], description: 'Deal 2 wounds to target follower.' } },
    ],
  },
];

export function registerTestCards(): void {
  for (const card of testCards) {
    registerCard(card);
  }
}

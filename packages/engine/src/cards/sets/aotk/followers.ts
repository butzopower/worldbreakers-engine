import { CardDefinition } from '../../../types/cards';

export const followers: CardDefinition[] = [
  {
    id: 'earth_apprentice',
    name: 'Earth Apprentice',
    type: 'follower',
    guild: 'neutral',
    cost: 3,
    strength: 2,
    health: 2,
    description: 'Enters: Gain 1 Earth Standing. Enters: If you control at least 2 other followers, draw 1 card.',
    abilities: [
      {
        timing: 'enters',
        effects: [{ type: 'gain_standing', player: 'self', guild: 'earth', amount: 1 }],
        description: 'Gain 1 Earth Standing.',
      },
      {
        timing: 'enters',
        effects: [{
          type: 'conditional',
          condition: {
            type: 'min_card_count',
            filter: { type: 'follower', zone: ['board'], owner: 'controller', excludeSelf: true },
            count: 2,
          },
          effects: [{ type: 'draw_cards', player: 'self', count: 1 }],
        }],
        description: 'If you control at least 2 other followers, draw 1 card.',
      },
    ],
  },
  {
    id: 'airag_maker',
    name: 'Airag Maker',
    type: 'follower',
    guild: 'earth',
    cost: 2,
    strength: 2,
    health: 2,
    standingRequirement: { earth: 1 },
    description: 'Enters: Gain 1 standing with any guild.',
    abilities: [
      {
        timing: 'enters',
        effects: [{ type: 'gain_standing', player: 'self', guild: 'choose', amount: 1 }],
        description: 'Gain 1 standing with any guild.',
      },
    ],
  },
  {
    id: 'astute_tactician',
    name: 'Astute Tactician',
    type: 'follower',
    guild: 'earth',
    cost: 5,
    standingRequirement: { earth: 2 },
    strength: 5,
    health: 3,
    abilities: [
      {
        timing: 'attacks',
        effects: [{ type: 'gain_mythium', player: 'self', amount: 2 }],
        description: 'Gain 2 Mythium.',
      },
    ],
    description: 'Attacks: Gain 2 Mythium.',
  },
  {
    id: 'alamut_emissary',
    name: 'Alamut Emissary',
    type: 'follower',
    guild: 'void',
    cost: 4,
    standingRequirement: { void: 2 },
    strength: 2,
    health: 4,
    keywords: ['bloodshed']
  },
  {
    id: 'alert_warden',
    name: 'Alert Warden',
    type: 'follower',
    guild: 'moon',
    cost: 3,
    standingRequirement: { moon: 1 },
    strength: 4,
    health: 3,
    conditionalKeywords: [{
      keyword: 'stationary',
      condition: { type: 'standing_less_than', guild: 'moon', amount: 4 },
    }],
    description: 'While you have less than 4 Moon standing, Alert Warden has stationary.',
  },
  {
    id: 'alamut_saboteur',
    name: 'Alamut Saboteur',
    type: 'follower',
    guild: 'void',
    cost: 3,
    standingRequirement: { void: 2 },
    strength: 1,
    health: 4,
    abilities: [
      {
        timing: 'breach',
        effects: [{ type: 'discard', player: 'opponent', count: 1 }],
        description: 'Defending player discards a card.',
      },
    ],
    description: 'Breach: Defending player discards a card.',
  },
  {
    id: 'dogtamer',
    name: 'Dogtamer',
    type: 'follower',
    guild: 'earth',
    cost: 1,
    standingRequirement: { earth: 1 },
    strength: 1,
    health: 1,
    description: 'Enters: Migrate → Gain 3 Mythium. (Either gain 1 Earth standing, or spend 1 Earth standing to gain 3 Mythium.)',
    abilities: [{
      timing: 'enters',
      effects: [
        { type: 'migrate', effects: [{ type: 'gain_mythium', player: 'self', amount: 3 }] },
      ],
      description: 'Migrate → Gain 3 Mythium.',
    }],
  },
  {
    id: 'stars_apprentice',
    name: 'Stars Apprentice',
    type: 'follower',
    guild: 'neutral',
    cost: 3,
    strength: 2,
    health: 2,
    description: 'Enters: Gain 1 Stars Standing. Enters: If you control a location, draw 1 card.',
    abilities: [
      {
        timing: 'enters',
        effects: [{ type: 'gain_standing', player: 'self', guild: 'stars', amount: 1 }],
        description: 'Gain 1 Stars Standing.',
      },
      {
        timing: 'enters',
        effects: [{
          type: 'conditional',
          condition: {
            type: 'min_card_count',
            filter: { type: 'location', zone: ['board'], owner: 'controller' },
            count: 1,
          },
          effects: [{ type: 'draw_cards', player: 'self', count: 1 }],
        }],
        description: 'If you control a location, draw 1 card.',
      },
    ],
  },
];

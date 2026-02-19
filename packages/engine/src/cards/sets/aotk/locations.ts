import { CardDefinition } from '../../../types/cards';

export const locations: CardDefinition[] = [
  {
    id: 'alamut_castle',
    name: 'Alamut Castle',
    type: 'location',
    guild: 'void',
    cost: 7,
    standingRequirement: { void: 2 },
    stages: 3,
    locationStages: [
      {
        stage: 1,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_power', player: 'self', amount: 1 }],
          description: 'Gain 1 power.',
        },
      },
      {
        stage: 2,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_power', player: 'self', amount: 1 }],
          description: 'Gain 1 power.',
        },
      },
      {
        stage: 3,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_power', player: 'self', amount: 2 }],
          description: 'Gain 2 power.',
        },
      },
    ],
    abilities: [{
      timing: 'your_attack',
      effects: [{
        type: 'conditional',
        condition: { type: 'attacking_alone' },
        effects: [
          { type: 'ready', target: { kind: 'all', filter: { zone: ['worldbreaker'], owner: 'controller' } } },
          { type: 'develop', target: { kind: 'self' } },
        ],
      }],
      description: 'Your Attack: If one of your followers is attacking alone → Ready your Worldbreaker and develop Alamut Castle.',
    }],
    description: 'I: Gain 1 power. II: Gain 1 power. III: Gain 2 power. Your Attack: If one of your followers is attacking alone → Ready your Worldbreaker and develop Alamut Castle.',
  },
  {
    id: 'covert_exchange',
    name: 'Covert Exchange',
    type: 'location',
    guild: 'stars',
    cost: 2,
    standingRequirement: { stars: 2 },
    stages: 3,
    keywords: ['hidden'],
    locationStages: [
      {
        stage: 1,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_mythium', player: 'self', amount: 4 }],
          description: 'Gain 4 mythium.',
        },
      },
      {
        stage: 2,
        ability: {
          timing: 'enters',
          effects: [{ type: 'draw_cards', player: 'self', count: 2 }],
          description: 'Draw 2 cards.',
        },
      },
      {
        stage: 3,
        ability: {
          timing: 'enters',
          effects: [
            { type: 'draw_cards', player: 'self', count: 1 },
            { type: 'gain_mythium', player: 'self', amount: 2 },
          ],
          description: 'Draw 1 card and gain 2 mythium.',
        },
      },
    ],
    description: 'Hidden (Your opponent cannot damage this location.) I: Gain 4 mythium. II: Draw 2 cards. III: Draw 1 card and gain 2 mythium.',
  },
  {
    id: 'the_den_of_sabers',
    name: 'The Den of Sabers',
    type: 'location',
    guild: 'neutral',
    cost: 4,
    stages: 3,
    locationStages: [
      {
        stage: 1,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_power', player: 'self', amount: 1 }],
          description: 'Gain 1 power.',
        },
      },
      {
        stage: 2,
        ability: {
          timing: 'enters',
          effects: [
            { type: 'draw_cards', player: 'self', count: 1 },
            { type: 'gain_standing', player: 'self', guild: 'choose', amount: 1 },
          ],
          description: 'Draw 1 card and gain 1 standing with any guild.',
        },
      },
      {
        stage: 3,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_power', player: 'self', amount: 2 }],
          description: 'Gain 2 power.',
        },
      },
    ],
    description: 'I: Gain 1 power. II: Draw 1 card and gain 1 standing with any guild. III: Gain 2 power.',
  },
  {
    id: 'the_indigo_grotto',
    name: 'The Indigo Grotto',
    type: 'location',
    guild: 'neutral',
    cost: 9,
    stages: 3,
    locationStages: [
      {
        stage: 1,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_power', player: 'self', amount: 2 }],
          description: 'Gain 2 power.',
        },
      },
      {
        stage: 2,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_power', player: 'self', amount: 3 }],
          description: 'Gain 3 power.',
        },
      },
      {
        stage: 3,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_power', player: 'self', amount: 1 }],
          description: 'Gain 1 power.',
        },
      },
    ],
    description: 'I: Gain 2 power. II: Gain 3 power. III: Gain 1 power.',
  },
  {
    id: 'the_pit_of_despair',
    name: 'The Pit of Despair',
    type: 'location',
    guild: 'neutral',
    cost: 7,
    stages: 3,
    locationStages: [
      {
        stage: 1,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_power', player: 'self', amount: 2 }],
          description: 'Gain 2 power.',
        },
      },
      {
        stage: 2,
        ability: {
          timing: 'enters',
          effects: [
            { type: 'gain_mythium', player: 'self', amount: 2 },
            { type: 'gain_power', player: 'self', amount: 1 },
          ],
          description: 'Gain 2 mythium and 1 power.',
        },
      },
      {
        stage: 3,
        ability: {
          timing: 'enters',
          effects: [
            { type: 'draw_cards', player: 'self', count: 2 },
            { type: 'gain_power', player: 'self', amount: 1 },
          ],
          description: 'Draw 2 cards and gain 1 power.',
        },
      },
    ],
    description: 'I: Gain 2 power. II: Gain 2 mythium and 1 power. III: Draw 2 cards and gain 1 power.',
  },
  {
    id: 'the_submerged_brilliance',
    name: 'The Submerged Brilliance',
    type: 'location',
    guild: 'neutral',
    cost: 3,
    stages: 3,
    locationStages: [
      {
        stage: 1,
        ability: {
          timing: 'enters',
          effects: [
            { type: 'draw_cards', player: 'self', count: 2 },
            { type: 'gain_mythium', player: 'self', amount: 2 },
          ],
          description: 'Draw 2 cards and gain 2 mythium.',
        },
      },
      {
        stage: 2,
        ability: {
          timing: 'enters',
          effects: [
            { type: 'gain_power', player: 'self', amount: 1 },
            { type: 'gain_standing', player: 'self', guild: 'choose', amount: 1 },
          ],
          description: 'Gain 1 power and 1 standing with any guild.',
        },
      },
      {
        stage: 3,
        ability: {
          timing: 'enters',
          effects: [{ type: 'gain_power', player: 'self', amount: 1 }],
          description: 'Gain 1 power.',
        },
      },
    ],
    description: 'I: Draw 2 cards and gain 2 mythium. II: Gain 1 power and 1 standing with any guild. III: Gain 1 power.',
  },
  {
    id: 'the_humble_underpass',
    name: 'The Humble Underpass',
    type: 'location',
    guild: 'neutral',
    cost: 2,
    stages: 2,
    locationStages: [
      {
        stage: 1,
        ability: {
          timing: 'enters',
          effects: [
            { type: 'gain_mythium', player: 'self', amount: 2 },
            { type: 'gain_power', player: 'self', amount: 1 },
          ],
          description: 'Gain 2 mythium and 1 power.',
        },
      },
      {
        stage: 2,
        ability: {
          timing: 'enters',
          effects: [
            { type: 'gain_mythium', player: 'self', amount: 2 },
            { type: 'gain_standing', player: 'self', guild: 'choose', amount: 1 },
          ],
          description: 'Gain 2 mythium and 1 standing with any guild.',
        },
      },
    ],
    description: 'I: Gain 2 mythium and 1 power. II: Gain 2 mythium and 1 standing with any guild.',
  },
];

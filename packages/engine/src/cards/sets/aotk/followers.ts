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
];

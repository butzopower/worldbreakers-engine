import { CardDefinition } from '../../../types/cards';

export const locations: CardDefinition[] = [
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
            {
              type: 'choose_one',
              modes: [
                { label: 'Gain 1 Earth standing', effects: [{ type: 'gain_standing', player: 'self', guild: 'earth', amount: 1 }] },
                { label: 'Gain 1 Moon standing', effects: [{ type: 'gain_standing', player: 'self', guild: 'moon', amount: 1 }] },
                { label: 'Gain 1 Void standing', effects: [{ type: 'gain_standing', player: 'self', guild: 'void', amount: 1 }] },
                { label: 'Gain 1 Stars standing', effects: [{ type: 'gain_standing', player: 'self', guild: 'stars', amount: 1 }] },
              ],
            },
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
];

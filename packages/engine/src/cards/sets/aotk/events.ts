import { CardDefinition } from '../../../types/cards.js';

export const events: CardDefinition[] = [
  {
    id: 'mythium_fund',
    name: 'Mythium Fund',
    type: 'event',
    guild: 'neutral',
    cost: 5,
    abilities: [{
      timing: 'enters',
      effects: [{ type: 'gain_mythium', player: 'self', amount: 9 }],
      description: 'Gain 9 Mythium.',
    }],
  },
];
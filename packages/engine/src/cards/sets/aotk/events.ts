import { CardDefinition } from '../../../types/cards';

export const events: CardDefinition[] = [
  {
    id: 'mythium_fund',
    name: 'Mythium Fund',
    type: 'event',
    guild: 'neutral',
    cost: 5,
    description: 'Gain 9 Mythium.',
    abilities: [{
      timing: 'enters',
      effects: [{ type: 'gain_mythium', player: 'self', amount: 9 }],
      description: 'Gain 9 Mythium.',
    }],
  },
  {
    id: 'gratuitous_gift',
    name: 'Gratuitous Gift',
    type: 'event',
    guild: 'neutral',
    cost: 0,
    description: 'Play a follower card, paying 2 mythium less.',
    abilities: [{
      timing: 'enters',
      customResolve: 'gratuitous_gift',
      description: 'Play a follower card, paying 2 mythium less.',
    }],
  },
];
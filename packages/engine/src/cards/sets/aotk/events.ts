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
      effects: [{ type: 'play_card', target: { kind: 'choose', filter: { type: 'follower', zone: ['hand'], owner: 'controller', canPay: { costReduction: 2 } }, count: 1 }, costReduction: 2 }],
      description: 'Play a follower card, paying 2 mythium less.',
    }],
  },
  {
    id: 'frantic_getaway',
    name: 'Frantic Getaway',
    type: 'event',
    guild: 'stars',
    cost: 1,
    standingRequirement: { stars: 2 },
    description: 'Develop a location you control. Develop a location you control.',
    abilities: [{
      timing: 'enters',
      effects: [
        { type: 'develop', target: { kind: 'choose', filter: { type: 'location', zone: ['board'], owner: 'controller' }, count: 1 } },
        { type: 'develop', target: { kind: 'choose', filter: { type: 'location', zone: ['board'], owner: 'controller' }, count: 1 } },
      ],
      description: 'Develop a location you control. Develop a location you control.',
    }],
  },
];
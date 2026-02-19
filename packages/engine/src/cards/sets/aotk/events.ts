import { CardDefinition } from '../../../types/cards';

export const events: CardDefinition[] = [
  {
    id: 'lay_siege',
    name: 'Lay Siege',
    type: 'event',
    guild: 'earth',
    cost: 3,
    standingRequirement: { earth: 2 },
    description: 'Deplete a non-hidden location. (It is placed in its owner\'s discard pile.)',
    abilities: [{
      timing: 'enters',
      effects: [{ type: 'deplete', target: { kind: 'choose', filter: { type: 'location', zone: ['board'], notKeyword: 'hidden' }, count: 1 } }],
      description: 'Deplete a non-hidden location.',
    }],
  },
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
    id: 'serpent_strike',
    name: 'Serpent Strike',
    type: 'event',
    guild: 'void',
    cost: 1,
    standingRequirement: { void: 1 },
    description: 'Your followers gain lethal until end of combat. Attack.',
    abilities: [{
      timing: 'enters',
      effects: [
        {
          type: 'grant_lasting_effect',
          target: { kind: 'all', filter: { type: 'follower', zone: ['board'], owner: 'controller' } },
          effect: 'lethal',
          expiresAt: 'end_of_combat',
        },
        { type: 'initiate_attack' },
      ],
      description: 'Your followers gain lethal until end of combat. Attack.',
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
    id: 'bolt_trap',
    name: 'Bolt Trap',
    type: 'event',
    guild: 'moon',
    cost: 2,
    standingRequirement: { moon: 1 },
    description: 'Defeat a follower with printed cost 3 or less.',
    abilities: [{
      timing: 'enters',
      effects: [{ type: 'defeat', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'], maxCost: 3 }, count: 1 } }],
      description: 'Defeat a follower with printed cost 3 or less.',
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
  {
    id: 'amazing_arithmetic',
    name: 'Amazing Arithmetic',
    type: 'event',
    guild: 'void',
    cost: 0,
    standingRequirement: { void: 1 },
    description: 'Gain 2 Mythium. You may attack.',
    abilities: [{
      timing: 'enters',
      effects: [
        { type: 'gain_mythium', player: 'self', amount: 2 },
        { type: 'choose_one', modes: [
          { label: 'Attack', effects: [{ type: 'initiate_attack' }] },
          { label: 'Pass', effects: [] },
        ]},
      ],
      description: 'Gain 2 Mythium. You may attack.',
    }],
  },
];
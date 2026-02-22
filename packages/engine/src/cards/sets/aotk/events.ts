import { CardDefinition } from '../../../types/cards';
import { CustomResolverFn } from "../../../abilities/system";
import { CardInstance, GameState } from "../../../types/state";
import { ResolveContext } from "../../../abilities/primitives";
import { GameEvent } from "../../../types/events";
import { getCardDef, getDeck, isFollower } from "../../../state/query";
import { drawCard, moveCard, shuffleDeck } from "../../../state/mutate";
import { STANDING_GUILDS } from "../../../types/core";

export const events: CardDefinition[] = [
  {
    id: 'call_to_arms',
    name: 'Call to Arms',
    type: 'event',
    guild: 'earth',
    cost: 0,
    standingRequirement: { earth: 1 },
    abilities: [{
      timing: 'enters',
      customResolve: 'call_to_arms',
      description: 'Reveal cards from the top of your deck until you reveal two follower cards. Draw them both and shuffle your deck. You may play one of those cards (paying all costs).',
    }]
  },
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
      effects: [{ type: 'destroy', target: { kind: 'choose', filter: { type: 'location', zone: ['board'], notKeyword: 'hidden' }, count: 1 } }],
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
    id: 'ger_migration',
    name: 'Ger Migration',
    type: 'event',
    guild: 'earth',
    cost: 1,
    standingRequirement: { earth: 1 },
    description: 'Choose one: Draw 2 cards and gain 1 standing with any guild. • Spend 1 Earth standing. If you do, gain 5 Mythium.',
    abilities: [{
      timing: 'enters',
      effects: [{
        type: 'choose_one',
        modes: [
          {
            label: 'Draw 2 cards and gain 1 standing with any guild',
            effects: [
              { type: 'draw_cards', player: 'self', count: 2 },
              { type: 'gain_standing', player: 'self', guild: 'choose', amount: 1 },
            ],
          },
          {
            label: 'Spend 1 Earth standing. Gain 5 Mythium.',
            effects: [
              { type: 'lose_standing', player: 'self', guild: 'earth', amount: 1 },
              { type: 'gain_mythium', player: 'self', amount: 5 },
            ],
          },
        ],
      }],
      description: 'Choose one: Draw 2 cards and gain 1 standing with any guild. • Spend 1 Earth standing. If you do, gain 5 Mythium.',
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
      effects: [{ type: 'destroy', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'], maxCost: 3 }, count: 1 } }],
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
    id: 'blood_moon',
    name: 'Blood Moon',
    type: 'event',
    guild: 'moon',
    cost: 7,
    standingRequirement: { moon: 3 },
    description: 'Choose one: Defeat all followers. Deplete all locations.',
    abilities: [{
      timing: 'enters',
      effects: [{
        type: 'choose_one',
        modes: [
          {
            label: 'Defeat all followers',
            effects: [{ type: 'destroy', target: { kind: 'all', filter: { type: 'follower', zone: ['board'] } } }],
          },
          {
            label: 'Deplete all locations',
            effects: [{ type: 'destroy', target: { kind: 'all', filter: { type: 'location', zone: ['board'] } } }],
          },
        ],
      }],
      description: 'Choose one: Defeat all followers. Deplete all locations.',
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
  {
    id: 'the_ten_thousand_ride',
    name: 'The Ten Thousand Ride',
    type: 'event',
    guild: 'earth',
    cost: 0,
    standingRequirement: { earth: 3 },
    description: 'Play a follower card (paying all costs). Attack.',
    abilities: [{
      timing: 'enters',
      effects: [
        { type: 'play_card', target: { kind: 'choose', filter: { type: 'follower', zone: ['hand'], owner: 'controller', canPay: {} }, count: 1 } },
        { type: 'initiate_attack' },
      ],
      description: 'Play a follower card (paying all costs). Attack.',
    }],
  },
  {
    id: 'wild_boar_charge',
    name: 'Wild Boar Charge',
    type: 'event',
    guild: 'earth',
    cost: 2,
    standingRequirement: { earth: 1 },
    description: 'Defeat a wounded follower.',
    abilities: [{
      timing: 'enters',
      effects: [{ type: 'destroy', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'], wounded: true }, count: 1 } }],
      description: 'Defeat a wounded follower.',
    }],
  },
];

export const eventResolvers: {key: string, resolver: CustomResolverFn}[] = [
  {
    key: 'call_to_arms',
    resolver: (
      state: GameState,
      ctx: ResolveContext,
    ): { state: GameState; events: GameEvent[] } => {
      const player = ctx.controller;
      const deck = getDeck(state, player);
      const cardsToReveal: CardInstance[] = [];

      if (deck.length === 0) {
        return { state, events: [] };
      }

      for (const card of deck) {
        cardsToReveal.push(card);
        if (cardsToReveal.filter(isFollower).length >= 2) break;
      }

      let newState = state;
      const events: GameEvent[] = [
        {
          type: 'reveal',
          player,
          cardDefinitionIds: cardsToReveal.map(c => c.definitionId)
        }
      ];

      const revealedFollowers = cardsToReveal.filter(isFollower);

      for (const follower of revealedFollowers) {
        const r = moveCard(newState, follower.instanceId, 'hand');
        newState = r.state;
        events.push(...r.events)
      }

      const shuffleResult = shuffleDeck(newState, player);
      newState = shuffleResult.state;
      events.push(...shuffleResult.events)

      if (revealedFollowers.length > 0) {
        const cardInstanceIds = revealedFollowers.map(f => f.instanceId);
        newState = {
          ...newState,
          pendingChoice: {
            type: 'choose_mode',
            playerId: player,
            sourceCardId: ctx.sourceCardId,
            modes: [
              { label: 'Play one of the drawn followers',
                effects: [
                  {
                    type: 'play_card',
                    target: { kind: 'choose', filter: { cardInstanceIds, canPay: {} }, count: 1 }
                  }
                ]
              },
              { label: 'Pass', effects: [] }
            ],
          }
        }
      }

      return { state: newState, events}
    }
  }
]
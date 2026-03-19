import { CardDefinition } from '../../../types/cards';
import { CustomResolverFn } from "../../../abilities/system";
import { CardInstance, GameState } from "../../../types/state";
import { ResolveContext } from "../../../abilities/primitives";
import { GameEvent } from "../../../types/events";
import { getCard, getCardDef, getDeck, getPassiveCostReduction, isFollower } from "../../../state/query";
import { drawCard, moveCard, shuffleDeck } from "../../../state/mutate";
import { STANDING_GUILDS } from "../../../types/core";
import { StepResult } from "../../../engine/step-handlers";
import { EngineStep } from "../../../types/steps";
import { EffectPrimitive, Mode } from "../../../types/effects";

export const events: CardDefinition[] = [
  {
    id: 'call_to_arms',
    name: 'Call to Arms',
    type: 'event',
    guild: 'earth',
    cost: 0,
    standingRequirement: { earth: 1 },
    abilities: [{
      timing: 'play',
      customResolve: 'call_to_arms',
      description: 'Reveal cards from the top of your deck until you reveal two follower cards. Draw them both and shuffle your deck. You may play one of those cards (paying all costs).',
    }]
  },
  {
    id: 'exploitative_extraction',
    name: 'Exploitative Extraction',
    type: 'event',
    guild: 'stars',
    cost: 'x',
    standingRequirement: { stars: 3 },
    description: 'X must be less than or equal to your Stars standing. Do the following X times: Develop a location you control.',
    abilities: [{
      timing: 'play',
      customResolve: 'exploitative_extraction',
      description: 'X must be less than or equal to your Stars standing. Do the following X times: Develop a location you control.',
    }],
  },
  {
    id: 'hide_in_plain_sight',
    name: 'Hide in Plain Sight',
    type: 'event',
    guild: 'void',
    cost: 2,
    standingRequirement: { void: 3 },
    description: 'Attack with one follower. It cannot be blocked this combat.',
    abilities: [{
      timing: 'play',
      effects: [
        {
          type: 'grant_lasting_effect',
          target: { kind: 'choose', filter: { type: 'follower', zone: ['board'], owner: 'controller' }, count: 1 },
          effect: 'unblockable',
          expiresAt: 'end_of_combat',
        },
        { type: 'initiate_attack', maxAttackers: 1 },
      ],
      description: 'Attack with one follower. It cannot be blocked this combat.',
    }],
  },
  {
    id: 'inspirational_vision',
    name: 'Inspirational Vision',
    type: 'event',
    guild: 'stars',
    cost: 2,
    standingRequirement: { stars: 1 },
    description: 'Choose follower or location. Reveal cards from the top of your deck until you reveal a card of that type. Either draw that card or play it, paying 2 less. Shuffle your deck.',
    abilities: [{
        timing: 'play',
        effects: [{
            type: 'choose_one',
            modes: [
              { label: 'Follower', effects: [{ type: 'custom_resolve', customResolve: 'inspirational_vision_follower' }] },
              { label: 'Location', effects: [{ type: 'custom_resolve', customResolve: 'inspirational_vision_location' }] },
            ],
          }]
      }],
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
      timing: 'play',
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
      timing: 'play',
      effects: [{ type: 'gain_mythium', player: 'self', amount: 9 }],
      description: 'Gain 9 Mythium.',
    }],
  },
  {
    id: 'pacify',
    name: 'Pacify',
    type: 'event',
    guild: 'stars',
    cost: 3,
    standingRequirement: { stars: 1 },
    description: 'Put a stationary counter on a follower. (Followers with stationary can\'t attack.)',
    abilities: [{
      timing: 'play',
      effects: [{ type: 'add_counter', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'] }, count: 1 }, counter: 'stationary', amount: 1 }],
      description: 'Put a stationary counter on a follower.',
    }],
  },
  {
    id: 'straight_to_the_source',
    name: 'Straight to the Source',
    type: 'event',
    guild: 'stars',
    cost: 2,
    standingRequirement: { stars: 1 },
    description: 'Interrupt: Before you pay this card\'s cost, reveal up to 2 location cards from your hand → Straight to the Source costs 1 mythium less for each card you revealed. Gain 3 mythium.',
    costDiscount: {
      filter: { type: 'location', zone: ['hand'], owner: 'controller' },
      costReduction: 1,
      perTarget: true,
      maxTargets: 2,
      targetEffect: { type: 'reveal' },
    },
    abilities: [{
      timing: 'play',
      effects: [{ type: 'gain_mythium', player: 'self', amount: 3 }],
      description: 'Gain 3 mythium.',
    }],
  },
  {
    id: 'surprising_development',
    name: 'Surprising Development',
    type: 'event',
    guild: 'neutral',
    cost: 3,
    description: 'Interrupt: Before you pay this card\'s cost, damage a location you control → Surprising Development costs 3 mythium less. Gain 5 mythium.',
    costDiscount: {
      filter: { type: 'location', zone: ['board'], owner: 'controller' },
      costReduction: 3,
      maxTargets: 1,
      targetEffect: { type: 'remove_counter', counter: 'stage', amount: 1 },
    },
    abilities: [{
      timing: 'play',
      effects: [{ type: 'gain_mythium', player: 'self', amount: 5 }],
      description: 'Gain 5 mythium.',
    }],
  },
  {
    id: 'proof_of_the_grotto',
    name: 'Proof of the Grotto',
    type: 'event',
    guild: 'stars',
    cost: 1,
    standingRequirement: { stars: 1 },
    description: 'Play a card, paying 1 mythium less for each standing you have across all guilds.',
    abilities: [{
      timing: 'play',
      customResolve: 'proof_of_the_grotto',
      description: 'Play a card, paying 1 mythium less for each standing you have across all guilds.',
    }],
  },
  {
    id: 'pernicious_powder',
    name: 'Pernicious Powder',
    type: 'event',
    guild: 'void',
    cost: 4,
    standingRequirement: { void: 3 },
    description: 'Deal 2 wounds to each of up to 3 followers.',
    abilities: [{
      timing: 'play',
      effects: [
        { type: 'optional', label: 'Deal 2 wounds to a follower', effects: [{ type: 'deal_wounds', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'] }, count: 1 }, amount: 2 }] },
        { type: 'optional', label: 'Deal 2 wounds to a follower', effects: [{ type: 'deal_wounds', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'] }, count: 1 }, amount: 2 }] },
        { type: 'optional', label: 'Deal 2 wounds to a follower', effects: [{ type: 'deal_wounds', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'] }, count: 1 }, amount: 2 }] },
      ],
      description: 'Deal 2 wounds to each of up to 3 followers.',
    }],
  },
  {
    id: 'raid_the_mines',
    name: 'Raid the Mines',
    type: 'event',
    guild: 'neutral',
    cost: 2,
    description: 'Attack. Response: The first time you gain power during this combat → Gain 5 mythium.',
    abilities: [{
      timing: 'play',
      effects: [
        { type: 'register_combat_response', trigger: 'on_power_gain', effects: [{ type: 'gain_mythium', player: 'self', amount: 5 }] },
        { type: 'initiate_attack' },
      ],
      description: 'Attack. Response: The first time you gain power during this combat → Gain 5 mythium.',
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
      timing: 'play',
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
    id: 'vicious_stab',
    name: 'Vicious Stab',
    type: 'event',
    guild: 'void',
    cost: 1,
    standingRequirement: { void: 1 },
    description: 'Deal 2 wounds to a follower.',
    abilities: [{
      timing: 'play',
      effects: [
        { type: 'deal_wounds', target: { kind: 'choose', filter: { type: 'follower', zone: ['board'] }, count: 1 }, amount: 2 },
      ],
      description: 'Deal 2 wounds to a follower.',
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
      timing: 'play',
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
      timing: 'play',
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
      timing: 'play',
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
      timing: 'play',
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
      timing: 'play',
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
      timing: 'play',
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
      timing: 'play',
      effects: [
        { type: 'play_card', target: { kind: 'choose', filter: { type: 'follower', zone: ['hand'], owner: 'controller', canPay: {} }, count: 1 } },
        { type: 'initiate_attack' },
      ],
      description: 'Play a follower card (paying all costs). Attack.',
    }],
  },
  {
    id: 'throes_of_fancy',
    name: 'Throes of Fancy',
    type: 'event',
    guild: 'stars',
    cost: 1,
    standingRequirement: { stars: 3 },
    description: 'Reveal cards from the top of your deck until you reveal a follower and a location. Draw them both and shuffle your deck. You may play either or both of those cards (paying all costs).',
    abilities: [{
      timing: 'play',
      customResolve: 'throes_of_fancy',
      description: 'Reveal cards from the top of your deck until you reveal a follower and a location. Draw them both and shuffle your deck. You may play either or both of those cards (paying all costs).',
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
      timing: 'play',
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
    ): EngineStep[] => {
      const player = ctx.controller;
      const deck = getDeck(state, player);
      const cardsToReveal: CardInstance[] = [];

      if (deck.length === 0) {
        return [];
      }

      for (const card of deck) {
        cardsToReveal.push(card);
        if (cardsToReveal.filter(isFollower).length >= 2) break;
      }

      const revealedFollowers = cardsToReveal.filter(isFollower);
      const steps: EngineStep[] = revealedFollowers.map(follower => (
        {
          type: 'move_card',
          cardInstanceId: follower.instanceId,
          toZone: 'hand'
        }
      ));

      steps.push(
        {
          type: 'reveal_cards',
          player,
          cardDefinitionIds: cardsToReveal.map(c => c.definitionId),
        }
      )

      steps.push(
        {
          type: 'shuffle_deck',
          player,
        }
      )

      if (revealedFollowers.length > 0) {
        const cardInstanceIds = revealedFollowers.map(f => f.instanceId);
        steps.push(
          {
            type: 'request_choose_mode',
            player,
            sourceCardId: ctx.sourceCardId,
            modes: [
              {
                label: 'Play one of the drawn followers',
                effects: [{ type: 'play_card', target: { kind: 'choose', filter: { cardInstanceIds, canPay: {} }, count: 1 } }],
              },
              { label: 'Pass', effects: [] },
            ],
          }
        )
      }

      return steps;
    }
  },
  {
    key: 'exploitative_extraction',
    resolver: (state: GameState, ctx: ResolveContext): EngineStep[] => {
      const player = ctx.controller;
      const costReduction = ctx.costReduction ?? 0;
      const starsStanding = state.players[player].standing.stars;
      const mythium = state.players[player].mythium;

      // Max X is bounded by stars standing; mythium limits what you can actually pay
      const maxX = starsStanding;
      if (maxX === 0) return [];

      const modes: Mode[] = [];
      for (let x = 1; x <= maxX; x++) {
        const actualCost = Math.max(0, x - costReduction);
        if (actualCost > mythium) break;
        const effects: EffectPrimitive[] = [];
        if (actualCost > 0) {
          effects.push({ type: 'lose_mythium', player: 'controller', amount: actualCost });
        }
        for (let i = 0; i < x; i++) {
          effects.push({
            type: 'develop',
            target: { kind: 'choose', filter: { type: 'location', zone: ['board'], owner: 'controller' }, count: 1 },
          });
        }
        modes.push({ label: `Pay ${actualCost} mythium, develop ${x} time${x > 1 ? 's' : ''}`, effects });
      }

      if (modes.length === 0) return [];

      return [{
        type: 'request_choose_mode',
        player,
        sourceCardId: ctx.sourceCardId,
        modes,
      }];
    },
  },
  {
    key: 'throes_of_fancy',
    resolver: (state: GameState, ctx: ResolveContext): EngineStep[] => {
      const player = ctx.controller;
      const deck = getDeck(state, player);

      const cardsToReveal: CardInstance[] = [];
      let foundFollower: CardInstance | undefined;
      let foundLocation: CardInstance | undefined;

      for (const card of deck) {
        cardsToReveal.push(card);
        if (!foundFollower && isFollower(card)) foundFollower = card;
        if (!foundLocation && getCardDef(card).type === 'location') foundLocation = card;
        if (foundFollower && foundLocation) break;
      }

      const steps: EngineStep[] = [];

      if (foundFollower) steps.push({ type: 'move_card', cardInstanceId: foundFollower.instanceId, toZone: 'hand' });
      if (foundLocation) steps.push({ type: 'move_card', cardInstanceId: foundLocation.instanceId, toZone: 'hand' });

      if (cardsToReveal.length > 0) {
        steps.push({ type: 'reveal_cards', player, cardDefinitionIds: cardsToReveal.map(c => c.definitionId) });
      }

      steps.push({ type: 'shuffle_deck', player });

      const toPlay = [
        ...(foundFollower ? [foundFollower.instanceId] : []),
        ...(foundLocation ? [foundLocation.instanceId] : []),
      ];
      if (toPlay.length > 0) {
        steps.push({ type: 'request_choose_play_order', player, cardInstanceIds: toPlay });
      }

      return steps;
    },
  },
  {
    key: 'inspirational_vision_follower',
    resolver: (state: GameState, ctx: ResolveContext): EngineStep[] =>
      inspirationalVisionSearch(state, ctx, 'follower'),
  },
  {
    key: 'inspirational_vision_location',
    resolver: (state: GameState, ctx: ResolveContext): EngineStep[] =>
      inspirationalVisionSearch(state, ctx, 'location'),
  },
  {
    key: 'proof_of_the_grotto',
    resolver: (
      state: GameState,
      ctx: ResolveContext,
    ): EngineStep[] => {
      const player = ctx.controller;
      const totalStanding = STANDING_GUILDS.reduce(
        (sum, guild) => sum + state.players[player].standing[guild], 0
      );

      return [{
        type: 'resolve_effects',
        effects: [{
          type: 'play_card',
          target: {
            kind: 'choose',
            filter: { zone: ['hand'], owner: 'controller', canPay: { costReduction: totalStanding } },
            count: 1,
          },
          costReduction: totalStanding,
        }],
        ctx,
      }];
    }
  }
];

function inspirationalVisionSearch(
  state: GameState,
  ctx: ResolveContext,
  searchType: 'follower' | 'location',
): EngineStep[] {
  const player = ctx.controller;
  const deck = getDeck(state, player);

  if (deck.length === 0) {
    return [{ type: 'shuffle_deck', player }];
  }

  const cardsToReveal: CardInstance[] = [];
  let foundCard: CardInstance | undefined;

  for (const card of deck) {
    cardsToReveal.push(card);
    if (getCardDef(card).type === searchType) {
      foundCard = card;
      break;
    }
  }

  const steps: EngineStep[] = [
    {
      type: 'reveal_cards',
      player,
      cardDefinitionIds: cardsToReveal.map(c => c.definitionId),
    },
  ];

  if (foundCard) {
    steps.push({
      type: 'move_card',
      cardInstanceId: foundCard.instanceId,
      toZone: 'hand',
    });
    steps.push({ type: 'shuffle_deck', player });
    steps.push({
      type: 'request_choose_mode',
      player,
      sourceCardId: ctx.sourceCardId,
      modes: [
        {
          label: 'Draw it',
          effects: [],
        },
        {
          label: 'Play it (2 less)',
          effects: [{
            type: 'play_card',
            target: {
              kind: 'choose',
              filter: { cardInstanceIds: [foundCard.instanceId], canPay: { costReduction: 2 } },
              count: 1,
            },
            costReduction: 2,
          }],
        },
      ],
    });
  } else {
    steps.push({ type: 'shuffle_deck', player });
  }

  return steps;
}
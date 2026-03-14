import { CardDefinition } from '../../../types/cards';
import { GameState } from '../../../types/state';
import { ResolveContext } from '../../../abilities/primitives';
import { EngineStep } from '../../../types/steps';
import { getDeck, isFollower } from '../../../state/query';
import { CustomResolverFn } from '../../../abilities/system';

export const worldbreakers: CardDefinition[] = [
  {
    id: 'khutulun_the_true_daughter',
    name: 'Khutulun, the True Daughter',
    type: 'worldbreaker',
    cost: 0,
    guild: 'earth',
    abilities: [
      {
        timing: 'your_attack',
        effects: [
          {
            type: 'grant_lasting_effect',
            target: { kind: 'choose', filter: { owner: 'controller', type: 'follower', zone: 'board' }, count: 1 },
            effect: 'strength_buff',
            amount: 1,
            expiresAt: 'end_of_combat'
          },
        ]
      }
    ],
    description: 'Your Attack: One attacking follower gets +1 strength for this combat.',
  },
  {
    id: 'marco_polo_robed_in_silk',
    name: 'Marco Polo, Robed in Silk',
    type: 'worldbreaker',
    cost: 0,
    guild: 'stars',
    abilities: [
      {
        timing: 'location_played',
        effects: [
          {
            type: 'exhausts',
            effects: [{ type: 'custom_resolve', customResolve: 'marco_polo_robed_in_silk' }],
          },
        ],
        description: 'Response — Location Played: Exhaust → Reveal the top card of your deck. If it is a follower card, draw it. Otherwise, put it on the bottom of your deck.',
      }
    ],
    description: 'Response — Location Played: Exhaust → Reveal the top card of your deck. If it is a follower card, draw it. Otherwise, put it on the bottom of your deck.',
  },
];

export const worldbreakerResolvers: { key: string; resolver: CustomResolverFn }[] = [
  {
    key: 'marco_polo_robed_in_silk',
    resolver: (
      state: GameState,
      ctx: ResolveContext,
    ): EngineStep[] => {
      const player = ctx.controller;
      const deck = getDeck(state, player);

      if (deck.length === 0) {
        return [];
      }

      const topCard = deck[0];
      const steps: EngineStep[] = [];

      steps.push({
        type: 'reveal_cards',
        player,
        cardDefinitionIds: [topCard.definitionId],
      });

      if (isFollower(topCard)) {
        steps.push({ type: 'draw_card', player });
      } else {
        steps.push({ type: 'move_card_to_deck_bottom', cardInstanceId: topCard.instanceId });
      }

      return steps;
    },
  },
];

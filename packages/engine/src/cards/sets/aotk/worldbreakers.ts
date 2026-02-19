import { CardDefinition } from '../../../types/cards';

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
    ]
  }
]
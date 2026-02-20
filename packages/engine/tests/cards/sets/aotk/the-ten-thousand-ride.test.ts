import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('The Ten Thousand Ride', () => {
  hasPlayCost('the_ten_thousand_ride', 0, { earth: 3 });

  it('plays the chosen follower then initiates an attack', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 3)
      .withMythium('player1', 1)
      .addCard('the_ten_thousand_ride', 'player1', 'hand', { instanceId: 'ttr1' })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ttr1' },
    });

    const result = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expectCardInZone(result.state, 'ms1', 'board');
    expect(result.waitingFor?.type).toBe('choose_attackers');
  });

  it('skips play follower and still initiates attack when no followers in hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withStanding('player1', 'earth', 3)
      .withMythium('player1', 0)
      .addCard('the_ten_thousand_ride', 'player1', 'hand', { instanceId: 'ttr1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'ttr1' },
    });

    expect(result.waitingFor?.type).toBe('choose_attackers');
  });
});

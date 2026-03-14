import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectCardInZone, expectCardCounter, expectPlayerPower } from '../../../helpers/assertions.js';
import { autoAccept } from "../../../helpers/auto-accept";

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Silkworm Terrarium', () => {
  it('is hidden', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 1)
      .addCard('silkworm_terrarium', 'player1', 'hand', { instanceId: 'loc1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    });

    expectCardInZone(result.state, 'loc1', 'board');
  });

  it('discards a card and develops a location when accepted', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 1)
      .withStanding('player1', 'earth', 1)
      .addCard('silkworm_terrarium', 'player1', 'hand', { instanceId: 'loc1' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'loc2', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'hand1' })
      .build();

    // Play silkworm terrarium
    let result = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    }));

    // Choose card to discard
    result = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_discard', cardInstanceIds: ['hand1'] },
    });

    // Choose location to develop
    result = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'loc2' },
    });

    expectCardInZone(result.state, 'hand1', 'discard');
    // Watchtower had 2 stage counters, develop removes 1
    expectCardCounter(result.state, 'loc2', 'stage', 1);
  });

  it('fizzles when accepted with no cards in hand', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 1)
      .addCard('silkworm_terrarium', 'player1', 'hand', { instanceId: 'loc1' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'loc2', counters: { stage: 2 } })
      .build();

    // Playing the terrarium empties the hand
    let result = autoAccept(processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    }));

    // Ability fizzles — no discard, no develop
    expect(result.state.pendingChoice).toBeNull();
    expectCardCounter(result.state, 'loc2', 'stage', 2);
  });

  it('integrates with Marco Polo: draw a follower then discard it to develop', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .withStanding('player1', 'stars', 1)
      .addCard('marco_polo_robed_in_silk', 'player1', 'worldbreaker', { instanceId: 'wb1' })
      .addCard('silkworm_terrarium', 'player1', 'hand', { instanceId: 'loc1' })
      .addCard('watchtower', 'player1', 'board', { instanceId: 'loc2', counters: { stage: 2 } })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .build();

    // Play Silkworm Terrarium — hand is now empty
    let result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'loc1' },
    });

    // Both Marco Polo (location_played) and Silkworm enters trigger
    // location_played fires first — accept Marco Polo's response
    expect(result.state.pendingChoice?.type).toBe('choose_trigger_order');
    result = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_trigger', triggerIndex: 0 },
    });

    // Marco Polo reveals a follower and draws it
    expectCardInZone(result.state, 'deck1', 'hand');
    const wb = result.state.cards.find(c => c.instanceId === 'wb1')!;
    expect(wb.exhausted).toBe(true);

    // Now Silkworm Terrarium's enters trigger fires — accept it
    expect(result.state.pendingChoice?.type).toBe('choose_trigger_order');
    result = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_trigger', triggerIndex: 0 },
    });

    // Discard the drawn follower
    result = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_discard', cardInstanceIds: ['deck1'] },
    });

    // Develop the watchtower
    result = processAction(result.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'loc2' },
    });

    expectCardInZone(result.state, 'deck1', 'discard');
    expectCardCounter(result.state, 'loc2', 'stage', 1);
  });

  it('stage I gains 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .addCard('silkworm_terrarium', 'player1', 'board', { instanceId: 'loc1', counters: { stage: 2 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'loc1' },
    });

    expectPlayerPower(result.state, 'player1', 1);
    expectCardCounter(result.state, 'loc1', 'stage', 1);
  });

  it('stage II gains 1 power', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 10)
      .addCard('silkworm_terrarium', 'player1', 'board', { instanceId: 'loc1', counters: { stage: 1 } })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'develop', locationInstanceId: 'loc1' },
    });

    expectPlayerPower(result.state, 'player1', 1);
    // Location is depleted (0 stages) and should be discarded
    expectCardInZone(result.state, 'loc1', 'discard');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { clearRegistry } from "../../src/cards/registry";
import { processAction, registerTestCards } from "../../src";
import { buildState } from "../helpers/state-builder";
import { expectCardInZone } from "../helpers/assertions";

beforeEach(() => {
  clearRegistry();
  registerTestCards();
});

describe('engine flow', () => {
  it('supports multiple queued pending choices', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .withStanding('player1', 'void', 3)
      .addCard('void_rift', 'player1', 'hand', { instanceId: 'vr1' })
      .addCard('mother_lode', 'player1', 'hand', { instanceId: 'ml1' })
      .addCard('mother_lode', 'player2', 'hand', { instanceId: 'ml2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'vr1' },
    });

    const p1DiscardResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_discard', cardInstanceIds: ['ml1']}
    });

    const p2DiscardResult = processAction(p1DiscardResult.state, {
      player: 'player2',
      action: { type: 'choose_discard', cardInstanceIds: ['ml2']}
    });

    expectCardInZone(p2DiscardResult.state, 'vr1', 'discard');
    expectCardInZone(p2DiscardResult.state, 'ml1', 'discard');
    expectCardInZone(p2DiscardResult.state, 'ml2', 'discard');
  });
})
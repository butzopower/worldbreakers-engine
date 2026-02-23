import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry';
import { processAction } from '../../../../src/engine/engine';
import { buildState } from '../../../helpers/state-builder';
import { expectPlayerMythium, expectPlayerPower } from '../../../helpers/assertions';
import { hasPlayCost } from '../../../helpers/properties';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Raid the Mines', () => {
  hasPlayCost('raid_the_mines', 2);

  it('playing initiates attack (choose_attackers pending choice)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('raid_the_mines', 'player1', 'hand', { instanceId: 'rtm1' })
      .addCard('gallant_soldier', 'player1', 'board', { instanceId: 'gs1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'rtm1' },
    });

    expect(result.state.pendingChoice).not.toBeNull();
    expect(result.state.pendingChoice!.type).toBe('choose_attackers');
  });

  it('after breach (unblocked attacker), gains 5 mythium from response', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('raid_the_mines', 'player1', 'hand', { instanceId: 'rtm1' })
      .addCard('gallant_soldier', 'player1', 'board', { instanceId: 'gs1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'rtm1' },
    });

    const chooseAttackers = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['gs1'] },
    });

    // Pass block — no defenders
    const passResult = processAction(chooseAttackers.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // 5 starting - 2 cost + 5 response = 8
    expectPlayerMythium(passResult.state, 'player1', 8);
    // 1 power from breach
    expectPlayerPower(passResult.state, 'player1', 1);
  });

  it('response only fires once per combat (multiple attackers breach, still only 5 mythium)', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('raid_the_mines', 'player1', 'hand', { instanceId: 'rtm1' })
      .addCard('gallant_soldier', 'player1', 'board', { instanceId: 'gs1' })
      .addCard('gallant_soldier', 'player1', 'board', { instanceId: 'gs2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'rtm1' },
    });

    const chooseAttackers = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['gs1', 'gs2'] },
    });

    const passResult = processAction(chooseAttackers.state, {
      player: 'player2',
      action: { type: 'pass_block' },
    });

    // 5 starting - 2 cost + 5 response (once) = 8
    expectPlayerMythium(passResult.state, 'player1', 8);
    // 2 power from 2 breaching attackers
    expectPlayerPower(passResult.state, 'player1', 2);
  });

  it('no followers to attack with — no combat, no response', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('raid_the_mines', 'player1', 'hand', { instanceId: 'rtm1' })
      .build();

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'rtm1' },
    });

    expect(result.state.pendingChoice).toBeNull();
    expect(result.state.combat).toBeNull();
    // 5 starting - 2 cost, no response
    expectPlayerMythium(result.state, 'player1', 3);
  });

  it('overwhelm power gain also triggers the response', () => {
    // champion_of_the_tumen is 4/2 overwhelm
    // lowly_bard is 1/1 (blocker that will be defeated)
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 5)
      .addCard('raid_the_mines', 'player1', 'hand', { instanceId: 'rtm1' })
      .addCard('champion_of_the_tumen', 'player1', 'board', { instanceId: 'cot1' })
      .addCard('lowly_bard', 'player2', 'board', { instanceId: 'lb1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'rtm1' },
    });

    const chooseAttackers = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_attackers', attackerIds: ['cot1'] },
    });

    // Block with lowly_bard — it will be defeated, triggering overwhelm
    const blockResult = processAction(chooseAttackers.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'lb1', attackerId: 'cot1' },
    });

    // 5 starting - 2 cost + 5 response from overwhelm power gain = 8
    expectPlayerMythium(blockResult.state, 'player1', 8);
    // 1 power from overwhelm
    expectPlayerPower(blockResult.state, 'player1', 1);
  });
});

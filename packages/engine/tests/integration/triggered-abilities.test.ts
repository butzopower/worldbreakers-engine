import { describe, it, expect, beforeEach } from 'vitest';
import { registerTestCards } from '../../src/cards/test-cards';
import { clearRegistry } from '../../src/cards/registry.js';
import { processAction } from '../../src/engine/engine.js';
import { buildState } from '../helpers/state-builder.js';
import { expectHandSize, expectPlayerMythium } from '../helpers/assertions.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
});

describe('follower_defeated trigger (death_watcher)', () => {
  it('gains 1 mythium when a follower is defeated', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
      .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eo1' },
    });

    const mythiumBefore = playResult.state.players['player1'].mythium;

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    const ms1 = targetResult.state.cards.find(c => c.instanceId === 'ms1');
    expect(ms1?.zone).toBe('discard');
    expect(targetResult.state.players['player1'].mythium).toBe(mythiumBefore + 1);
  });

  it('triggers once per defeated follower', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
      .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms2' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eo1' },
    });

    const mythiumBefore = playResult.state.players['player1'].mythium;

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    // Only 1 follower defeated → only +1 mythium from trigger
    expect(targetResult.state.players['player1'].mythium).toBe(mythiumBefore + 1);
    const ms2 = targetResult.state.cards.find(c => c.instanceId === 'ms2');
    expect(ms2?.zone).toBe('board');
  });

  it('triggers for both players if both have a death_watcher on board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
      .addCard('death_watcher', 'player2', 'board', { instanceId: 'dw2' })
      .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eo1' },
    });

    const p1MythiumBefore = playResult.state.players['player1'].mythium;
    const p2MythiumBefore = playResult.state.players['player2'].mythium;

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'ms1' },
    });

    expect(targetResult.state.players['player1'].mythium).toBe(p1MythiumBefore + 1);
    expect(targetResult.state.players['player2'].mythium).toBe(p2MythiumBefore + 1);
  });

  it('does not trigger when no follower is defeated', () => {
    // execution_order with no valid targets — effect skipped, no defeat event
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('death_watcher', 'player1', 'board', { instanceId: 'dw1' })
      .addCard('execution_order', 'player1', 'hand', { instanceId: 'eo1' })
      .build(); // no followers on board

    const mythiumBefore = state.players['player1'].mythium;

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'eo1' },
    });

    // No defeat → no trigger → mythium unchanged
    expect(result.state.players['player1'].mythium).toBe(mythiumBefore);
  });
});

describe('location_depleted trigger (ruin_watcher)', () => {
  it('draws 1 card when a location is depleted', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('ruin_watcher', 'player1', 'board', { instanceId: 'rw1' })
      .addCard('demolish', 'player1', 'hand', { instanceId: 'dm1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' }) // card to draw
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'dm1' },
    });

    const handSizeBefore = playResult.state.players['player1'].handSize;

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'wt1' },
    });

    const wt1 = targetResult.state.cards.find(c => c.instanceId === 'wt1');
    expect(wt1?.zone).toBe('discard');
    expect(targetResult.state.players['player1'].handSize).toBe(handSizeBefore + 1);
  });

  it('triggers for both players if both have a ruin_watcher on board', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('ruin_watcher', 'player1', 'board', { instanceId: 'rw1' })
      .addCard('ruin_watcher', 'player2', 'board', { instanceId: 'rw2' })
      .addCard('demolish', 'player1', 'hand', { instanceId: 'dm1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .addCard('militia_scout', 'player2', 'deck', { instanceId: 'deck2' })
      .addCard('watchtower', 'player2', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    const playResult = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'dm1' },
    });

    const p1HandBefore = playResult.state.players['player1'].handSize;
    const p2HandBefore = playResult.state.players['player2'].handSize;

    const targetResult = processAction(playResult.state, {
      player: 'player1',
      action: { type: 'choose_target', targetInstanceId: 'wt1' },
    });

    expect(targetResult.state.players['player1'].handSize).toBe(p1HandBefore + 1);
    expect(targetResult.state.players['player2'].handSize).toBe(p2HandBefore + 1);
  });

  it('does not trigger when no location is depleted', () => {
    // demolish with no valid targets — effect skipped, no deplete event
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('ruin_watcher', 'player1', 'board', { instanceId: 'rw1' })
      .addCard('demolish', 'player1', 'hand', { instanceId: 'dm1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' }) // would be drawn if trigger fires
      .build(); // no locations on board

    const result = processAction(state, {
      player: 'player1',
      action: { type: 'play_card', cardInstanceId: 'dm1' },
    });

    // No depletion → no trigger → deck card not drawn
    const deckCard = result.state.cards.find(c => c.instanceId === 'deck1');
    expect(deckCard?.zone).toBe('deck');
  });
});

describe('overwhelms trigger (overwhelming_warrior)', () => {
  it('prompts choose_mode after defeating a blocker', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('overwhelming_warrior', 'player1', 'board', { instanceId: 'ow1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ow1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ms1', attackerId: 'ow1' },
    });

    expect(blockResult.waitingFor?.type).toBe('choose_mode');
  });

  it('choosing "Gain 2 Mythium" grants 2 mythium to the attacking player', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .withMythium('player1', 0)
      .addCard('overwhelming_warrior', 'player1', 'board', { instanceId: 'ow1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ow1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ms1', attackerId: 'ow1' },
    });

    const result = processAction(blockResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 0 },
    });

    expectPlayerMythium(result.state, 'player1', 2);
  });

  it('choosing "Draw 2 cards" draws 2 cards for the attacking player', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('overwhelming_warrior', 'player1', 'board', { instanceId: 'ow1' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck1' })
      .addCard('militia_scout', 'player1', 'deck', { instanceId: 'deck2' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ow1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ms1', attackerId: 'ow1' },
    });

    const result = processAction(blockResult.state, {
      player: 'player1',
      action: { type: 'choose_mode', modeIndex: 1 },
    });

    expectHandSize(result.state, 'player1', 2);
  });

  it('does not trigger when the blocker survives combat', () => {
    // overwhelming_warrior (3 str) vs earthshaker_giant (4 health) — blocker not defeated
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('overwhelming_warrior', 'player1', 'board', { instanceId: 'ow1' })
      .addCard('earthshaker_giant', 'player2', 'board', { instanceId: 'eg1' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ow1'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'eg1', attackerId: 'ow1' },
    });

    // No overwhelm trigger — should not be waiting for choose_mode
    expect(blockResult.waitingFor?.type).not.toBe('choose_mode');
  });

  it('does not trigger for a non-overwhelm card that defeats a blocker', () => {
    const state = buildState()
      .withActivePlayer('player1')
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms_atk' })
      .addCard('militia_scout', 'player2', 'board', { instanceId: 'ms_blk' })
      .build();

    const attackResult = processAction(state, {
      player: 'player1',
      action: { type: 'attack', attackerIds: ['ms_atk'] },
    });

    const blockResult = processAction(attackResult.state, {
      player: 'player2',
      action: { type: 'declare_blocker', blockerId: 'ms_blk', attackerId: 'ms_atk' },
    });

    expect(blockResult.waitingFor?.type).not.toBe('choose_mode');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { registerTestCards } from '../../src/cards/test-cards/index.js';
import { clearRegistry, getCardDefinition } from '../../src/cards/registry.js';
import { createGameState, GameConfig } from '../../src/state/create.js';
import { buildState } from '../helpers/state-builder.js';
import {
  getCard, getCardDef, getBoard, getHand, getDeck, getFollowers, getLocations,
  getWorldbreaker, getEffectiveStrength, getEffectiveHealth, isDefeated,
  hasKeyword, canAttack, canBlock, canPlayCard, canDevelop, canUseAbility,
  getLocationStage, isLocationDepleted,
} from '../../src/state/query.js';

beforeEach(() => {
  clearRegistry();
  registerTestCards();
});

describe('createGameState', () => {
  it('creates initial state with correct structure', () => {
    const config: GameConfig = {
      player1Deck: {
        worldbreakerId: 'stone_sentinel',
        cardIds: ['militia_scout', 'militia_scout', 'shield_bearer', 'night_raider', 'void_channeler',
                  'star_warden', 'earthshaker_giant', 'sudden_strike', 'void_rift', 'watchtower'],
      },
      player2Deck: {
        worldbreakerId: 'void_oracle',
        cardIds: ['militia_scout', 'militia_scout', 'shield_bearer', 'night_raider', 'void_channeler',
                  'star_warden', 'earthshaker_giant', 'sudden_strike', 'void_rift', 'void_nexus'],
      },
      seed: 42,
    };

    const state = createGameState(config);

    expect(state.phase).toBe('action');
    expect(state.round).toBe(1);
    expect(state.actionsTaken).toBe(0);
    expect(state.firstPlayer).toBe('player1');
    expect(state.activePlayer).toBe('player1');
    expect(state.combat).toBeNull();
    expect(state.winner).toBeNull();

    // Each player should have 5 cards in hand
    expect(getHand(state, 'player1').length).toBe(5);
    expect(getHand(state, 'player2').length).toBe(5);

    // Each player should have 5 remaining cards in deck
    expect(getDeck(state, 'player1').length).toBe(5);
    expect(getDeck(state, 'player2').length).toBe(5);

    // Worldbreakers in their zone
    expect(getWorldbreaker(state, 'player1')).toBeDefined();
    expect(getWorldbreaker(state, 'player2')).toBeDefined();
    expect(getWorldbreaker(state, 'player1')!.definitionId).toBe('stone_sentinel');
    expect(getWorldbreaker(state, 'player2')!.definitionId).toBe('void_oracle');

    // Players start with 0 resources
    expect(state.players.player1.mythium).toBe(0);
    expect(state.players.player1.power).toBe(0);
    expect(state.players.player2.mythium).toBe(0);
    expect(state.players.player2.power).toBe(0);
  });

  it('produces deterministic state with same seed', () => {
    const config: GameConfig = {
      player1Deck: { worldbreakerId: 'stone_sentinel', cardIds: ['militia_scout', 'shield_bearer', 'night_raider', 'void_channeler', 'star_warden', 'earthshaker_giant', 'sudden_strike', 'void_rift', 'watchtower', 'militia_scout'] },
      player2Deck: { worldbreakerId: 'void_oracle', cardIds: ['militia_scout', 'shield_bearer', 'night_raider', 'void_channeler', 'star_warden', 'earthshaker_giant', 'sudden_strike', 'void_rift', 'void_nexus', 'militia_scout'] },
      seed: 123,
    };

    const state1 = createGameState(config);
    const state2 = createGameState(config);

    // Hands should be identical
    const hand1 = getHand(state1, 'player1').map(c => c.definitionId);
    const hand2 = getHand(state2, 'player1').map(c => c.definitionId);
    expect(hand1).toEqual(hand2);
  });
});

describe('State queries', () => {
  it('getEffectiveStrength returns base strength', () => {
    const state = buildState()
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    const card = getCard(state, 'ms1')!;
    expect(getEffectiveStrength(state, card)).toBe(1);
  });

  it('getEffectiveHealth accounts for wounds', () => {
    const state = buildState()
      .addCard('shield_bearer', 'player1', 'board', { instanceId: 'sb1', counters: { wound: 1 } })
      .build();

    const card = getCard(state, 'sb1')!;
    expect(getEffectiveHealth(card)).toBe(2); // 3 base - 1 wound
  });

  it('isDefeated returns true when wounds >= health', () => {
    const state = buildState()
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1', counters: { wound: 1 } })
      .build();

    const card = getCard(state, 'ms1')!;
    expect(isDefeated(card)).toBe(true);
  });

  it('hasKeyword detects keywords', () => {
    const state = buildState()
      .addCard('shield_bearer', 'player1', 'board', { instanceId: 'sb1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .build();

    expect(hasKeyword(getCard(state, 'sb1')!, 'stationary')).toBe(true);
    expect(hasKeyword(getCard(state, 'ms1')!, 'stationary')).toBe(false);
  });

  it('canAttack respects exhaustion and stationary', () => {
    const state = buildState()
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms2', exhausted: true })
      .addCard('shield_bearer', 'player1', 'board', { instanceId: 'sb1' })
      .build();

    expect(canAttack(state, getCard(state, 'ms1')!)).toBe(true);
    expect(canAttack(state, getCard(state, 'ms2')!)).toBe(false); // exhausted
    expect(canAttack(state, getCard(state, 'sb1')!)).toBe(false); // stationary
  });

  it('canBlock allows non-exhausted followers', () => {
    const state = buildState()
      .addCard('shield_bearer', 'player1', 'board', { instanceId: 'sb1' })
      .addCard('militia_scout', 'player1', 'board', { instanceId: 'ms1', exhausted: true })
      .build();

    expect(canBlock(state, getCard(state, 'sb1')!)).toBe(true);
    expect(canBlock(state, getCard(state, 'ms1')!)).toBe(false);
  });

  it('canPlayCard checks mythium and standing requirements', () => {
    const state = buildState()
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 2)
      .addCard('militia_scout', 'player1', 'hand', { instanceId: 'ms1' })
      .addCard('earthshaker_giant', 'player1', 'hand', { instanceId: 'eg1' })
      .build();

    expect(canPlayCard(state, 'player1', getCard(state, 'ms1')!)).toBe(true);
    expect(canPlayCard(state, 'player1', getCard(state, 'eg1')!)).toBe(true);

    // Without enough standing
    const state2 = buildState()
      .withMythium('player1', 5)
      .withStanding('player1', 'earth', 1) // Need 2
      .addCard('earthshaker_giant', 'player1', 'hand', { instanceId: 'eg1' })
      .build();

    expect(canPlayCard(state2, 'player1', getCard(state2, 'eg1')!)).toBe(false);
  });

  it('getLocationStage and canDevelop work correctly', () => {
    const state = buildState()
      .addCard('watchtower', 'player1', 'board', { instanceId: 'wt1', counters: { stage: 3 } })
      .build();

    const card = getCard(state, 'wt1')!;
    expect(getLocationStage(card)).toBe(1);
    expect(canDevelop(state, 'player1', card)).toBe(true);
    expect(isLocationDepleted(card)).toBe(false);
  });
});

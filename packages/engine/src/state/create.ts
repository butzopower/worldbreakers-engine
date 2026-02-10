import { PlayerId, Guild, PLAYERS } from '../types/core';
import { GameState, PlayerState, CardInstance } from '../types/state';
import { generateInstanceId, resetIdCounter } from '../utils/id';
import { seededShuffle } from '../utils/random';
import { getCardDefinition } from "../cards/registry";

export interface DeckConfig {
  worldbreakerId: string;
  cardIds: string[];
}

export interface GameConfig {
  player1Deck: DeckConfig;
  player2Deck: DeckConfig;
  seed?: number;
  firstPlayer?: PlayerId;
}

function createPlayerState(guild: Guild): PlayerState {
  const standing = { earth: 0, moon: 0, void: 0, stars: 0 }

  if (guild !== 'neutral') {
    standing[guild] = 1
  }

  return {
    mythium: 5,
    power: 0,
    standing: standing,
    handSize: 0,
  };
}

function createCardInstance(
  definitionId: string,
  owner: PlayerId,
  zone: 'deck' | 'worldbreaker',
): CardInstance {
  return {
    instanceId: generateInstanceId(),
    definitionId,
    owner,
    zone,
    exhausted: false,
    counters: {},
    usedAbilities: [],
  };
}

export function createGameState(config: GameConfig): GameState {
  resetIdCounter();
  const seed = config.seed ?? Date.now();
  let rngState = seed;

  const cards: CardInstance[] = [];

  // Create worldbreakers
  cards.push(createCardInstance(config.player1Deck.worldbreakerId, 'player1', 'worldbreaker'));
  cards.push(createCardInstance(config.player2Deck.worldbreakerId, 'player2', 'worldbreaker'));

  // Create and shuffle player 1's deck
  const p1Cards = config.player1Deck.cardIds.map(id => createCardInstance(id, 'player1', 'deck'));
  const [p1Shuffled, rng1] = seededShuffle(p1Cards, rngState);
  rngState = rng1;
  cards.push(...p1Shuffled);

  // Create and shuffle player 2's deck
  const p2Cards = config.player2Deck.cardIds.map(id => createCardInstance(id, 'player2', 'deck'));
  const [p2Shuffled, rng2] = seededShuffle(p2Cards, rngState);
  rngState = rng2;
  cards.push(...p2Shuffled);

  const firstPlayer = config.firstPlayer ?? 'player1';

  // Draw opening hands (5 cards each)
  const state: GameState = {
    version: 0,
    phase: 'action',
    round: 1,
    actionsTaken: 0,
    firstPlayer,
    activePlayer: firstPlayer,
    players: {
      player1: createPlayerState(getCardDefinition(config.player1Deck.worldbreakerId).guild),
      player2: createPlayerState(getCardDefinition(config.player2Deck.worldbreakerId).guild),
    },
    cards,
    combat: null,
    pendingChoice: null,
    lastingEffects: [],
    rngState,
    winner: null,
  };

  // Draw 5 cards for each player
  return drawOpeningHands(state);
}

function drawOpeningHands(state: GameState): GameState {
  let s = state;
  for (const player of PLAYERS) {
    for (let i = 0; i < 5; i++) {
      s = drawOneCard(s, player);
    }
  }
  return s;
}

function drawOneCard(state: GameState, player: PlayerId): GameState {
  const deckCards = state.cards.filter(c => c.owner === player && c.zone === 'deck');
  if (deckCards.length === 0) return state;

  // Take from the top (first element)
  const topCard = deckCards[0];
  return {
    ...state,
    version: state.version + 1,
    cards: state.cards.map(c =>
      c.instanceId === topCard.instanceId
        ? { ...c, zone: 'hand' as const }
        : c
    ),
    players: {
      ...state.players,
      [player]: {
        ...state.players[player],
        handSize: state.players[player].handSize + 1,
      },
    },
  };
}

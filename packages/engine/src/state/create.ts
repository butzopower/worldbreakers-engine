import { PlayerId, Guild, PLAYERS } from '../types/core';
import { GameState, PlayerState, CardInstance } from '../types/state';
import { generateInstanceId, resetIdCounter } from '../utils/id';
import { getCardDefinition } from "../cards/registry";
import { shuffleDeck } from "./mutate";
import { nextRandom } from '../utils/random';

export interface DeckConfig {
  worldbreakerId: string;
  cardIds: string[];
}

export interface GameConfig {
  player1Deck: DeckConfig;
  player2Deck: DeckConfig;
  seed?: number;
  firstPlayer?: PlayerId;
  skipMulligan?: boolean;
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
    bonusActions: 0,
    pendingBonusActions: 0,
    powerGainedThisRound: false,
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
    markAsDestroyed: false,
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

  // Create player 1's deck
  const p1Cards = config.player1Deck.cardIds.map(id => createCardInstance(id, 'player1', 'deck'));
  cards.push(...p1Cards);

  // Create player 2's deck
  const p2Cards = config.player2Deck.cardIds.map(id => createCardInstance(id, 'player2', 'deck'));
  cards.push(...p2Cards);

  let firstPlayer: PlayerId;
  if (config.firstPlayer) {
    firstPlayer = config.firstPlayer;
  } else {
    const [rand, nextRngState] = nextRandom(rngState);
    rngState = nextRngState;
    firstPlayer = rand < 0.5 ? 'player1' : 'player2';
  }

  const startInMulligan = !config.skipMulligan;

  // Draw opening hands (5 cards each)
  let state: GameState = {
    version: 0,
    phase: startInMulligan ? 'mulligan' : 'action',
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
    combatResponses: [],
    rngState,
    winner: null,
    defeatedThisRound: [],
    stepQueue: null,
  };

  const p1Shuffle = shuffleDeck(state, 'player1');
  state = p1Shuffle.state

  const p2Shuffle = shuffleDeck(state, 'player2');
  state = p2Shuffle.state

  // Draw 5 cards for each player
  state = drawOpeningHands(state);

  // Set up mulligan pending choice for the first player
  if (startInMulligan) {
    state = { ...state, pendingChoice: { type: 'choose_mulligan', playerId: firstPlayer } };
  }

  return state;
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

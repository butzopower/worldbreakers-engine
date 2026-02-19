import { PlayerId, StandingGuild } from '../../src/types/core.js';
import { GameState, PlayerState, CardInstance } from '../../src/types/state.js';
import { CounterMap } from '../../src/types/counters.js';

let builderId = 1;

function defaultPlayerState(): PlayerState {
  return {
    mythium: 0,
    power: 0,
    standing: { earth: 0, moon: 0, void: 0, stars: 0 },
    handSize: 0,
  };
}

export class StateBuilder {
  private state: GameState;

  constructor() {
    this.state = {
      version: 0,
      phase: 'action',
      round: 1,
      actionsTaken: 0,
      firstPlayer: 'player1',
      activePlayer: 'player1',
      players: {
        player1: defaultPlayerState(),
        player2: defaultPlayerState(),
      },
      cards: [],
      combat: null,
      pendingChoice: null,
      lastingEffects: [],
      rngState: 42,
      winner: null,
    };
  }

  withActivePlayer(player: PlayerId): this {
    this.state.activePlayer = player;
    return this;
  }

  withFirstPlayer(player: PlayerId): this {
    this.state.firstPlayer = player;
    return this;
  }

  withRound(round: number): this {
    this.state.round = round;
    return this;
  }

  withActionsTaken(count: number): this {
    this.state.actionsTaken = count;
    return this;
  }

  withMythium(player: PlayerId, amount: number): this {
    this.state.players[player].mythium = amount;
    return this;
  }

  withPower(player: PlayerId, amount: number): this {
    this.state.players[player].power = amount;
    return this;
  }

  withStanding(player: PlayerId, guild: StandingGuild, amount: number): this {
    this.state.players[player].standing[guild] = amount;
    return this;
  }

  addCard(
    definitionId: string,
    owner: PlayerId,
    zone: CardInstance['zone'],
    opts?: { exhausted?: boolean; counters?: CounterMap; instanceId?: string },
  ): this {
    const instanceId = opts?.instanceId ?? `test_${builderId++}`;
    const card: CardInstance = {
      instanceId,
      definitionId,
      owner,
      zone,
      exhausted: opts?.exhausted ?? false,
      counters: opts?.counters ?? {},
      usedAbilities: [],
      markAsDestroyed: false,
    };
    this.state.cards.push(card);
    if (zone === 'hand') {
      this.state.players[owner].handSize++;
    }
    return this;
  }

  withRngState(seed: number): this {
    this.state.rngState = seed;
    return this;
  }

  build(): GameState {
    return structuredClone(this.state);
  }
}

export function buildState(): StateBuilder {
  return new StateBuilder();
}

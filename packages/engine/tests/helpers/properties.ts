import { processAction, StandingGuild } from "../../src";
import { buildState } from "./state-builder";
import { expectPlayerMythium } from "./assertions";
import { describe, expect, it } from "vitest";

export function hasPlayCost(cardId: string, mythiumCost: number, requiredStanding?: {earth?: number, moon?: number, void?: number, stars?: number}) {
  return describe(`costs for ${cardId}`, () => {
    it(`costs ${mythiumCost}`, () => {
      const startingMythium = 100;

      let stateBuilder = buildState()
        .withActivePlayer('player1')
        .withMythium('player1', startingMythium)
        .addCard(cardId, 'player1', 'hand', { instanceId: 'card1' })

      if (requiredStanding) {
        Object.entries(requiredStanding).forEach(([key, value]) => {
          stateBuilder = stateBuilder.withStanding('player1', key as StandingGuild, value);
        })
      }

      const state = stateBuilder.build()

      const result = processAction(state, {
        player: 'player1',
        action: { type: 'play_card', cardInstanceId: 'card1' },
      });

      expectPlayerMythium(result.state, 'player1', startingMythium - mythiumCost);
    });

    if (requiredStanding) {
      it(`requires standing to play`, () => {
        const state = buildState()
          .withActivePlayer('player1')
          .withMythium('player1', 5)
          .addCard(cardId, 'player1', 'hand', { instanceId: 'card1' })
          .build();

        expect(() => processAction(state, {
          player: 'player1',
          action: { type: 'play_card', cardInstanceId: 'card1' },
        })).toThrow('Invalid action');

      });
    }
  });
}
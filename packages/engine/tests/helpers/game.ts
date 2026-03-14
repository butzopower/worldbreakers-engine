import { processAction, getLegalActions, ProcessResult } from "../../src";
import { expect } from "vitest";

// automatically accepts the first optional triggered ability
export function autoAccept(input: ProcessResult) {
  expect(input.state.pendingChoice!.type).toBe('choose_trigger_order');

  return processAction(input.state, {
    player: input.state.activePlayer,
    action: { type: 'choose_trigger', triggerIndex: 0 },
  });
}

export function autoAcceptAll(input: ProcessResult) {
  expect(input.state.pendingChoice!.type).toBe('choose_trigger_order');
  let result = autoAccept(input);

  while ((result.state.pendingChoice?.type ?? '') === 'choose_trigger_order') {
    result = autoAccept(result);
  }

  return result;
}

export function goToNextRound(input: ProcessResult): ProcessResult {
  let result = input;
  const startRound = result.state.round;

  while (result.state.round === startRound) {
    result = processAction(result.state, {
      player: result.state.activePlayer,
      action: { type: 'gain_mythium' },
    });
  }

  return result;
}
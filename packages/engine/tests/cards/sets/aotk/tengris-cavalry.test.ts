import { describe, it, expect, beforeEach } from 'vitest';
import { registerSetCards } from '../../../../src/cards/sets';
import { registerTestCards } from '../../../../src/cards/test-cards';
import { clearRegistry } from '../../../../src/cards/registry.js';
import { processAction, getLegalActions } from '../../../../src/engine/engine.js';
import { buildState } from '../../../helpers/state-builder.js';
import { expectPlayerMythium, expectCardInZone } from '../../../helpers/assertions.js';
import { hasPlayCost } from "../../../helpers/properties";

beforeEach(() => {
  clearRegistry();
  registerTestCards();
  registerSetCards();
});

describe('Tengri\'s Cavalry', () => {
  hasPlayCost('tengris_cavalry', 3, { earth: 3 });
});

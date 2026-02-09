import { CardDefinition } from '../types/cards.js';

const cardRegistry = new Map<string, CardDefinition>();

export function registerCard(def: CardDefinition): void {
  if (cardRegistry.has(def.id)) {
    throw new Error(`Card already registered: ${def.id}`);
  }
  cardRegistry.set(def.id, def);
}

export function getCardDefinition(id: string): CardDefinition {
  const def = cardRegistry.get(id);
  if (!def) {
    throw new Error(`Unknown card definition: ${id}`);
  }
  return def;
}

export function getAllCardDefinitions(): CardDefinition[] {
  return Array.from(cardRegistry.values());
}

export function clearRegistry(): void {
  cardRegistry.clear();
}

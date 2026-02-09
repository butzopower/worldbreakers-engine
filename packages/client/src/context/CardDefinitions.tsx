import { createContext, useContext } from 'react';
import type { ClientCardDefinition } from '../types.js';

const CardDefinitionsContext = createContext<Record<string, ClientCardDefinition>>({});

export function CardDefinitionsProvider({ value, children }: { value: Record<string, ClientCardDefinition>; children: React.ReactNode }) {
  return (
    <CardDefinitionsContext.Provider value={value}>
      {children}
    </CardDefinitionsContext.Provider>
  );
}

export function useCardDefinitions(): Record<string, ClientCardDefinition> {
  return useContext(CardDefinitionsContext);
}

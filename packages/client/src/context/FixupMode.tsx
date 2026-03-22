import { createContext, useContext, useState } from 'react';

interface FixupModeValue {
  fixupMode: boolean;
  toggleFixupMode: () => void;
}

const FixupModeContext = createContext<FixupModeValue>({ fixupMode: false, toggleFixupMode: () => {} });

export function FixupModeProvider({ children }: { children: React.ReactNode }) {
  const [fixupMode, setFixupMode] = useState(false);
  return (
    <FixupModeContext.Provider value={{ fixupMode, toggleFixupMode: () => setFixupMode(f => !f) }}>
      {children}
    </FixupModeContext.Provider>
  );
}

export function useFixupMode(): FixupModeValue {
  return useContext(FixupModeContext);
}

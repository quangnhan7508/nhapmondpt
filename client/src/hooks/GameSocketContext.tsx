import React, { createContext, useContext } from 'react';
import { useGameSocket } from './useGameSocket';

type GameSocketApi = ReturnType<typeof useGameSocket>;

const GameSocketContext = createContext<GameSocketApi | null>(null);

export const GameSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useGameSocket();
  return <GameSocketContext.Provider value={api}>{children}</GameSocketContext.Provider>;
};

export function useGameSocketContext(): GameSocketApi {
  const ctx = useContext(GameSocketContext);
  if (!ctx) throw new Error('useGameSocketContext must be used within <GameSocketProvider>');
  return ctx;
}

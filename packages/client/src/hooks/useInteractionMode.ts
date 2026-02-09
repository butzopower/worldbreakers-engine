import { useState, useCallback } from 'react';
import type { InteractionMode } from '../types.js';

export function useInteractionMode() {
  const [mode, setMode] = useState<InteractionMode>({ type: 'none' });

  const reset = useCallback(() => setMode({ type: 'none' }), []);

  const startAttackSelection = useCallback(() => {
    setMode({ type: 'select_attackers', selected: [] });
  }, []);

  const toggleAttacker = useCallback((instanceId: string) => {
    setMode(prev => {
      if (prev.type !== 'select_attackers') return prev;
      const selected = prev.selected.includes(instanceId)
        ? prev.selected.filter(id => id !== instanceId)
        : [...prev.selected, instanceId];
      return { type: 'select_attackers', selected };
    });
  }, []);

  const startBlockerSelection = useCallback((attackerIds: string[]) => {
    setMode({ type: 'select_blocker', selectedBlockerId: null, attackerIds });
  }, []);

  const selectBlocker = useCallback((blockerId: string) => {
    setMode(prev => {
      if (prev.type !== 'select_blocker') return prev;
      return { ...prev, selectedBlockerId: blockerId };
    });
  }, []);

  const startTargetSelection = useCallback((validTargets: string[]) => {
    setMode({ type: 'choose_target', validTargets });
  }, []);

  const startDiscardSelection = useCallback((count: number) => {
    setMode({ type: 'choose_discard', count, selected: [] });
  }, []);

  const toggleDiscard = useCallback((instanceId: string) => {
    setMode(prev => {
      if (prev.type !== 'choose_discard') return prev;
      const selected = prev.selected.includes(instanceId)
        ? prev.selected.filter(id => id !== instanceId)
        : prev.selected.length < prev.count
          ? [...prev.selected, instanceId]
          : prev.selected;
      return { ...prev, selected };
    });
  }, []);

  const startBreachSelection = useCallback((validLocations: string[]) => {
    setMode({ type: 'choose_breach_target', validLocations });
  }, []);

  return {
    mode,
    reset,
    startAttackSelection,
    toggleAttacker,
    startBlockerSelection,
    selectBlocker,
    startTargetSelection,
    startDiscardSelection,
    toggleDiscard,
    startBreachSelection,
  };
}

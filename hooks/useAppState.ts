import { useEffect, useState } from 'react';
import { ApplicationState, type ApplicationStateSnapshot } from '@/application/ApplicationState';

/**
 * React hook for subscribing to ApplicationState changes.
 * Provides snapshot-based reactivity so components can select the state they need.
 */
export function useAppState(): ApplicationStateSnapshot {
  const appState = ApplicationState.getInstance();
  const [snapshot, setSnapshot] = useState<ApplicationStateSnapshot>(() => appState.getSnapshot());

  useEffect(() => {
    const unsubscribe = appState.subscribe(newSnapshot => {
      setSnapshot(newSnapshot);
    });

    return unsubscribe;
  }, [appState]);

  return snapshot;
}

/**
 * Selector-based convenience hook for consuming specific slices of ApplicationState.
 */
export function useAppStateSelector<T>(selector: (snapshot: ApplicationStateSnapshot) => T): T {
  const snapshot = useAppState();
  return selector(snapshot);
}

export function useCases() {
  return useAppStateSelector(snapshot => Array.from(snapshot.cases.values()));
}

export function useCase(id: string | null) {
  return useAppStateSelector(snapshot => (id ? snapshot.cases.get(id) ?? null : null));
}

export function useActivities() {
  return useAppStateSelector(snapshot => Array.from(snapshot.activities.values()));
}
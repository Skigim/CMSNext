import { useRef, useSyncExternalStore } from 'react';
import ApplicationState from '@/application/ApplicationState';
import type { Case } from '@/domain/cases/entities/Case';

export function useApplicationState<T>(
  selector: (state: ApplicationState) => T,
  equalityFn: (a: T, b: T) => boolean = Object.is,
): T {
  const selectorRef = useRef(selector);
  selectorRef.current = selector;

  const equalityRef = useRef(equalityFn);
  equalityRef.current = equalityFn;

  const selectionRef = useRef<T>(selectorRef.current(ApplicationState.getInstance()));

  const version = useSyncExternalStore(
    listener => ApplicationState.getInstance().subscribe(listener),
    () => ApplicationState.getInstance().getVersion(),
    () => 0,
  );
  void version;

  const state = ApplicationState.getInstance();
  const pendingSelection = selectorRef.current(state);
  if (!equalityRef.current(selectionRef.current, pendingSelection)) {
    selectionRef.current = pendingSelection;
  }

  return selectionRef.current;
}

export function useCases(): Case[] {
  return useApplicationState(appState => appState.getCases());
}

export function useCase(id: string): Case | null {
  return useApplicationState(appState => appState.getCase(id));
}

import { useCallback, useSyncExternalStore } from 'react';
import type { EditorEngine } from '../core/editor';

export function useProject(engine: EditorEngine) {
  const subscribe = useCallback((listener: () => void) => engine.subscribe(listener), [engine]);
  return useSyncExternalStore(subscribe, () => engine.getProject());
}

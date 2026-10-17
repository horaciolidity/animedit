import { useCallback, useEffect, useState } from 'react';
import { EditorEngine } from './core/editor';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Toolbar } from './components/Toolbar';
import { useToolStore } from './state/toolStore';

export function App() {
  const [engine] = useState(() => new EditorEngine());
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const sync = () => {
      setCanUndo(engine.history.canUndo);
      setCanRedo(engine.history.canRedo);
    };
    sync();
    return engine.subscribe(sync);
  }, [engine]);

  const undo = useCallback(() => engine.undo(), [engine]);
  const redo = useCallback(() => engine.redo(), [engine]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) engine.redo();
        else engine.undo();
      } else if (mod && key === 'y') {
        event.preventDefault();
        engine.redo();
      } else if (key === 'b') {
        useToolStore.getState().setTool('brush');
      } else if (key === 'e') {
        useToolStore.getState().setTool('eraser');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  return (
    <div className="app">
      <Toolbar onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />
      <main className="workspace">
        <DrawingCanvas engine={engine} />
      </main>
    </div>
  );
}

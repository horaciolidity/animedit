import { useCallback, useEffect, useState } from 'react';
import { EditorEngine } from './core/editor';
import { getFrameCount } from './core/project';
import { loadMostRecent, saveProject } from './core/persistence';
import { DrawingCanvas } from './components/DrawingCanvas';
import { Toolbar } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { Timeline } from './components/Timeline';
import { PlaybackBar } from './components/PlaybackBar';
import { PropertiesPanel } from './components/PropertiesPanel';
import { ProjectBar } from './components/ProjectBar';
import { useProject } from './hooks/useProject';
import { useToolStore } from './state/toolStore';
import { useUiStore } from './state/uiStore';

export function App() {
  const [engine] = useState(() => new EditorEngine());
  const project = useProject(engine);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadMostRecent()
      .then((saved) => {
        if (!cancelled && saved) engine.loadProject(saved);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [engine]);

  useEffect(() => {
    if (!ready) return;
    let timer: number | undefined;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void saveProject(engine.getProject()).catch(() => undefined);
      }, 1000);
    };
    const unsubscribe = engine.subscribe(schedule);
    return () => {
      unsubscribe();
      window.clearTimeout(timer);
    };
  }, [engine, ready]);

  useEffect(() => {
    const sync = () => {
      setCanUndo(engine.history.canUndo);
      setCanRedo(engine.history.canRedo);
    };
    sync();
    return engine.subscribe(sync);
  }, [engine]);

  useEffect(() => {
    const { activeLayerId } = useUiStore.getState();
    if (!project.layers.some((layer) => layer.id === activeLayerId)) {
      useUiStore.getState().setActiveLayer(project.layers[0]?.id ?? '');
    }
  }, [project]);

  useEffect(() => {
    const count = getFrameCount(project);
    if (useUiStore.getState().currentFrame >= count) {
      useUiStore.getState().setCurrentFrame(count - 1);
    }
  }, [project]);

  const undo = useCallback(() => engine.undo(), [engine]);
  const redo = useCallback(() => engine.redo(), [engine]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
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
      } else if (key === 'v') {
        useToolStore.getState().setTool('move');
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        const max = getFrameCount(engine.getProject()) - 1;
        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const next = useUiStore.getState().currentFrame + delta;
        useUiStore.getState().setCurrentFrame(Math.min(max, next));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  return (
    <div className="app">
      <Toolbar onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />
      <ProjectBar engine={engine} />
      <div className="main">
        <LayerPanel engine={engine} />
        <main className="workspace">
          <DrawingCanvas engine={engine} />
        </main>
        <PropertiesPanel engine={engine} />
      </div>
      <PlaybackBar engine={engine} />
      <Timeline engine={engine} />
    </div>
  );
}

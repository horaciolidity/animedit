import { useEffect } from 'react';
import type { EditorEngine } from '../core/editor';
import { getFrameCount } from '../core/project';
import { useProject } from '../hooks/useProject';
import { useUiStore } from '../state/uiStore';
import { exportFramePng, exportWebM } from '../engine/exporter';

export function PlaybackBar({ engine }: { engine: EditorEngine }) {
  const project = useProject(engine);
  const currentFrame = useUiStore((s) => s.currentFrame);
  const isPlaying = useUiStore((s) => s.isPlaying);
  const onionEnabled = useUiStore((s) => s.onionEnabled);
  const onionBefore = useUiStore((s) => s.onionBefore);
  const onionAfter = useUiStore((s) => s.onionAfter);
  const setPlaying = useUiStore((s) => s.setPlaying);
  const setOnionEnabled = useUiStore((s) => s.setOnionEnabled);
  const setOnionBefore = useUiStore((s) => s.setOnionBefore);
  const setOnionAfter = useUiStore((s) => s.setOnionAfter);

  const fps = project.fps;

  useEffect(() => {
    if (!isPlaying) return;
    const id = window.setInterval(() => {
      const count = getFrameCount(engine.getProject());
      if (count <= 1) return;
      const current = useUiStore.getState().currentFrame;
      useUiStore.getState().setCurrentFrame((current + 1) % count);
    }, 1000 / fps);
    return () => window.clearInterval(id);
  }, [isPlaying, fps, engine]);

  return (
    <div className="playback-bar">
      <button className="tool" onClick={() => setPlaying(!isPlaying)}>
        {isPlaying ? 'Pausa' : 'Reproducir'}
      </button>

      <label className="field">
        FPS
        <select value={fps} onChange={(e) => engine.setFps(Number(e.target.value))}>
          {[8, 12, 24, 30].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <input
          type="checkbox"
          checked={onionEnabled}
          onChange={(e) => setOnionEnabled(e.target.checked)}
        />
        Papel cebolla
      </label>

      <label className="field">
        Antes
        <input
          type="number"
          min={0}
          max={4}
          value={onionBefore}
          onChange={(e) => setOnionBefore(Number(e.target.value))}
        />
      </label>

      <label className="field">
        Después
        <input
          type="number"
          min={0}
          max={4}
          value={onionAfter}
          onChange={(e) => setOnionAfter(Number(e.target.value))}
        />
      </label>

      <div className="group export-group">
        <button className="tool small" onClick={() => void exportFramePng(engine.getProject(), currentFrame)}>
          Exportar PNG
        </button>
        <button className="tool small" onClick={() => void exportWebM(engine.getProject())}>
          Exportar WebM
        </button>
      </div>
    </div>
  );
}

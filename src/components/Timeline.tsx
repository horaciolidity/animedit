import { Fragment } from 'react';
import type { EditorEngine } from '../core/editor';
import { getFrameCount, resolveFrameIndex } from '../core/project';
import { useProject } from '../hooks/useProject';
import { useUiStore } from '../state/uiStore';

function cellClass(activeRow: boolean, current: boolean, hasStrokes: boolean, key: boolean, held: boolean): string {
  const classes = ['tl-cell'];
  if (activeRow) classes.push('active-row');
  if (current) classes.push('current');
  if (hasStrokes) classes.push('has-stroke');
  if (key) classes.push('has-key');
  if (held) classes.push('held');
  return classes.join(' ');
}

export function Timeline({ engine }: { engine: EditorEngine }) {
  const project = useProject(engine);
  const currentFrame = useUiStore((s) => s.currentFrame);
  const activeLayerId = useUiStore((s) => s.activeLayerId);
  const setCurrentFrame = useUiStore((s) => s.setCurrentFrame);
  const setActiveLayer = useUiStore((s) => s.setActiveLayer);

  const frameCount = getFrameCount(project);
  const layers = [...project.layers].reverse();

  return (
    <section className="timeline">
      <div className="timeline-toolbar">
        <button className="tool small" onClick={() => engine.appendFrame()}>
          + Fotograma
        </button>
        <button
          className="tool small"
          onClick={() => activeLayerId && engine.duplicateFrame(activeLayerId, currentFrame)}
        >
          Duplicar dibujo
        </button>
        <button
          className="tool small"
          onClick={() => engine.removeFrame(currentFrame)}
          disabled={frameCount <= 1}
        >
          Borrar fotograma
        </button>
        <button
          className="tool small"
          onClick={() => activeLayerId && engine.clearFrame(activeLayerId, currentFrame)}
        >
          Limpiar
        </button>
        <span className="timeline-status">
          Fotograma {currentFrame + 1} / {frameCount} · {project.fps} fps
        </span>
      </div>

      <div
        className="timeline-grid"
        style={{ gridTemplateColumns: `150px repeat(${frameCount}, 28px)` }}
      >
        <div className="tl-corner" />
        {Array.from({ length: frameCount }, (_, i) => (
          <div
            key={`head-${i}`}
            className={i === currentFrame ? 'tl-frame-head current' : 'tl-frame-head'}
            onClick={() => setCurrentFrame(i)}
          >
            {i + 1}
          </div>
        ))}

        {layers.map((layer) => (
          <Fragment key={layer.id}>
            <div
              className={layer.id === activeLayerId ? 'tl-layer-name active' : 'tl-layer-name'}
              onClick={() => setActiveLayer(layer.id)}
            >
              {layer.name}
            </div>
            {layer.frames.map((frame, i) => {
              const sourceIndex = resolveFrameIndex(layer, i);
              const held = sourceIndex !== i;
              return (
                <div
                  key={`${layer.id}-${i}`}
                  className={cellClass(
                    layer.id === activeLayerId,
                    i === currentFrame,
                    frame.strokes.length > 0,
                    layer.keyframes.some((key) => key.frame === i),
                    held,
                  )}
                  onClick={() => {
                    setActiveLayer(layer.id);
                    setCurrentFrame(i);
                  }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

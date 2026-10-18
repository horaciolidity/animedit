import { useEffect, useState } from 'react';
import type { EditorEngine } from '../core/editor';
import { transformAt } from '../core/transform';
import { useProject } from '../hooks/useProject';
import { useUiStore } from '../state/uiStore';
import type { EasingKind, Transform } from '../model/types';

const EASINGS: { value: EasingKind; label: string }[] = [
  { value: 'linear', label: 'Lineal' },
  { value: 'easeIn', label: 'Acelerar' },
  { value: 'easeOut', label: 'Desacelerar' },
  { value: 'easeInOut', label: 'Suave' },
  { value: 'step', label: 'Escalonado' },
];

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

interface NumberFieldProps {
  label: string;
  value: number;
  step?: number;
  onCommit: (value: number) => void;
}

function NumberField({ label, value, step = 1, onCommit }: NumberFieldProps) {
  const [text, setText] = useState(String(round(value)));

  useEffect(() => {
    setText(String(round(value)));
  }, [value]);

  const commit = () => {
    const parsed = Number(text);
    if (Number.isFinite(parsed)) onCommit(parsed);
    else setText(String(round(value)));
  };

  return (
    <label className="field prop-field">
      {label}
      <input
        type="number"
        step={step}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

export function PropertiesPanel({ engine }: { engine: EditorEngine }) {
  const project = useProject(engine);
  const activeLayerId = useUiStore((s) => s.activeLayerId);
  const currentFrame = useUiStore((s) => s.currentFrame);

  const layer = project.layers.find((candidate) => candidate.id === activeLayerId) ?? null;

  if (!layer) {
    return (
      <aside className="properties">
        <div className="panel-header">
          <span>Propiedades</span>
        </div>
      </aside>
    );
  }

  const transform = transformAt(layer, currentFrame);
  const animated = layer.keyframes.length > 0;
  const keyHere = layer.keyframes.find((key) => key.frame === currentFrame) ?? null;

  const update = (patch: Partial<Transform>) => {
    engine.setTransformValue(layer.id, currentFrame, { ...transform, ...patch });
  };

  return (
    <aside className="properties">
      <div className="panel-header">
        <span>Propiedades</span>
      </div>
      <div className="properties-body">
        <div className="prop-section">
          <div className="prop-title">{layer.name}</div>
          <label className="field prop-field">
            Padre
            <select
              value={layer.parentId ?? ''}
              onChange={(e) => engine.setParent(layer.id, e.target.value || null)}
            >
              <option value="">(ninguno)</option>
              {project.layers
                .filter((candidate) => candidate.id !== layer.id)
                .map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.name}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <div className="prop-section">
          <div className="prop-title">Transformación {animated ? '(animada)' : ''}</div>
          <NumberField label="X" value={transform.x} onCommit={(x) => update({ x })} />
          <NumberField label="Y" value={transform.y} onCommit={(y) => update({ y })} />
          <NumberField
            label="Rot°"
            value={transform.rotation}
            onCommit={(rotation) => update({ rotation })}
          />
          <NumberField
            label="EscX"
            value={transform.scaleX}
            step={0.05}
            onCommit={(scaleX) => update({ scaleX })}
          />
          <NumberField
            label="EscY"
            value={transform.scaleY}
            step={0.05}
            onCommit={(scaleY) => update({ scaleY })}
          />
        </div>

        <div className="prop-section">
          <div className="prop-title">Fotogramas clave</div>
          <div className="group">
            <button className="tool small" onClick={() => engine.addKeyframe(layer.id, currentFrame)}>
              Agregar clave
            </button>
            <button
              className="tool small"
              onClick={() => engine.removeKeyframe(layer.id, currentFrame)}
              disabled={!keyHere}
            >
              Borrar clave
            </button>
          </div>
          <label className="field prop-field">
            Interpolación
            <select
              value={keyHere?.easing ?? 'linear'}
              disabled={!keyHere}
              onChange={(e) =>
                engine.setKeyframeEasing(layer.id, currentFrame, e.target.value as EasingKind)
              }
            >
              {EASINGS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="prop-hint">
            {animated
              ? `${layer.keyframes.length} clave(s). Editar crea clave en el fotograma actual.`
              : 'Sin animación: editar mueve la capa entera.'}
          </div>
        </div>
      </div>
    </aside>
  );
}

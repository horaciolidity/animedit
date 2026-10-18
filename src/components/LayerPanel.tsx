import { useEffect, useState } from 'react';
import type { EditorEngine } from '../core/editor';
import { useProject } from '../hooks/useProject';
import { useUiStore } from '../state/uiStore';
import type { Layer } from '../model/types';

interface LayerRowProps {
  engine: EditorEngine;
  layer: Layer;
}

function LayerRow({ engine, layer }: LayerRowProps) {
  const activeLayerId = useUiStore((s) => s.activeLayerId);
  const setActiveLayer = useUiStore((s) => s.setActiveLayer);
  const [name, setName] = useState(layer.name);

  useEffect(() => {
    setName(layer.name);
  }, [layer.name]);

  const active = layer.id === activeLayerId;

  const commitName = () => {
    const next = name.trim();
    if (next && next !== layer.name) engine.renameLayer(layer.id, next);
    else setName(layer.name);
  };

  return (
    <div className={active ? 'layer-row active' : 'layer-row'} onClick={() => setActiveLayer(layer.id)}>
      <button
        className="icon"
        title="Visibilidad"
        onClick={(e) => {
          e.stopPropagation();
          engine.toggleLayerVisibility(layer.id);
        }}
      >
        {layer.visible ? '\u25C9' : '\u25CB'}
      </button>
      <input
        className="layer-name"
        value={name}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      <button
        className="icon"
        title="Subir"
        onClick={(e) => {
          e.stopPropagation();
          engine.moveLayer(layer.id, 1);
        }}
      >
        {'\u25B2'}
      </button>
      <button
        className="icon"
        title="Bajar"
        onClick={(e) => {
          e.stopPropagation();
          engine.moveLayer(layer.id, -1);
        }}
      >
        {'\u25BC'}
      </button>
      <button
        className="icon"
        title="Eliminar"
        onClick={(e) => {
          e.stopPropagation();
          engine.removeLayer(layer.id);
        }}
      >
        {'\u2715'}
      </button>
      <input
        className="layer-opacity"
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={layer.opacity}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => engine.setLayerOpacity(layer.id, Number(e.target.value))}
      />
    </div>
  );
}

export function LayerPanel({ engine }: { engine: EditorEngine }) {
  const project = useProject(engine);
  const layers = [...project.layers].reverse();

  return (
    <aside className="layer-panel">
      <div className="panel-header">
        <span>Capas</span>
        <button className="tool small" onClick={() => engine.addLayer()}>
          + Capa
        </button>
      </div>
      <div className="layer-list">
        {layers.map((layer) => (
          <LayerRow key={layer.id} engine={engine} layer={layer} />
        ))}
      </div>
    </aside>
  );
}

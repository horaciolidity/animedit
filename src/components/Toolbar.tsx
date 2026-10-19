import { useToolStore } from '../state/toolStore';
import { useUiStore } from '../state/uiStore';
import { useProject } from '../hooks/useProject';
import type { EditorEngine } from '../core/editor';
import type { EditorTool } from '../model/types';

interface ToolbarProps {
  engine: EditorEngine;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TOOLS: { kind: EditorTool; label: string; hint: string }[] = [
  { kind: 'brush', label: 'Pincel', hint: 'B' },
  { kind: 'eraser', label: 'Borrador', hint: 'E' },
  { kind: 'line', label: 'Línea', hint: 'L' },
  { kind: 'rect', label: 'Rect', hint: 'R' },
  { kind: 'ellipse', label: 'Elipse', hint: 'O' },
  { kind: 'move', label: 'Mover', hint: 'V' },
];

const SHAPE_TOOLS: EditorTool[] = ['brush', 'eraser', 'line', 'rect', 'ellipse'];

const PALETTE_DEFAULT = ['#1e1e1e', '#ff5b5b', '#5b8cff', '#ffcf4d', '#7fe08a', '#e25bff'];

export function Toolbar({ engine, onUndo, onRedo, canUndo, canRedo }: ToolbarProps) {
  const tool = useToolStore((s) => s.tool);
  const color = useToolStore((s) => s.color);
  const size = useToolStore((s) => s.size);
  const setTool = useToolStore((s) => s.setTool);
  const setColor = useToolStore((s) => s.setColor);
  const setSize = useToolStore((s) => s.setSize);
  const zoom = useUiStore((s) => s.zoom);
  const resetView = useUiStore((s) => s.resetView);
  const zoomAt = useUiStore((s) => s.zoomAt);

  const project = useProject(engine);
  const palette = project.palette ?? PALETTE_DEFAULT;

  const showStyling = SHAPE_TOOLS.includes(tool);

  return (
    <header className="toolbar">
      <div className="group">
        {TOOLS.map((item) => (
          <button
            key={item.kind}
            className={tool === item.kind ? 'tool active' : 'tool'}
            onClick={() => setTool(item.kind)}
            title={`${item.label} (${item.hint})`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {showStyling ? (
        <>
          <div className="group">
            <label className="field">
              Color
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </label>
          </div>

          <div className="group">
            <label className="field">
              Tamaño
              <input
                type="range"
                min={1}
                max={80}
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
              />
              <span className="size-value">{size}</span>
            </label>
          </div>

          <div className="group palette-group">
            <span className="palette-label">Paleta</span>
            {palette.map((c, i) => (
              <button
                key={i}
                className={`palette-swatch ${color === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                onMouseDown={(e) => e.preventDefault()}
                title={c}
              />
            ))}
            <button
              className="palette-swatch palette-add"
              onClick={() => {
                setColor(color);
                void engine.addPaletteColor(color);
              }}
              title="Agregar color a la paleta"
            >
              +
            </button>
          </div>
        </>
      ) : null}

      <div className="group">
        <button className="tool" onClick={() => zoomAt(1 / 1.25, 0, 0, 0, 0)} title="Alejar (-)">
          −
        </button>
        <button className="tool" onClick={resetView} title="Restablecer vista (0)">
          {Math.round(zoom * 100)}%
        </button>
        <button className="tool" onClick={() => zoomAt(1.25, 0, 0, 0, 0)} title="Acercar (+)">
          +
        </button>
      </div>

      <div className="group">
        <button className="tool" onClick={onUndo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">
          Deshacer
        </button>
        <button className="tool" onClick={onRedo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)">
          Rehacer
        </button>
      </div>
    </header>
  );
}

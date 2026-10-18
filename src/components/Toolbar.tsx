import { useToolStore } from '../state/toolStore';
import type { EditorTool } from '../model/types';

interface ToolbarProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const TOOLS: { kind: EditorTool; label: string; hint: string }[] = [
  { kind: 'brush', label: 'Pincel', hint: 'B' },
  { kind: 'eraser', label: 'Borrador', hint: 'E' },
  { kind: 'move', label: 'Mover', hint: 'V' },
];

export function Toolbar({ onUndo, onRedo, canUndo, canRedo }: ToolbarProps) {
  const tool = useToolStore((s) => s.tool);
  const color = useToolStore((s) => s.color);
  const size = useToolStore((s) => s.size);
  const setTool = useToolStore((s) => s.setTool);
  const setColor = useToolStore((s) => s.setColor);
  const setSize = useToolStore((s) => s.setSize);

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

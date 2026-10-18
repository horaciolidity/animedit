import { useRef, useState } from 'react';
import type { EditorEngine } from '../core/editor';
import { createProject } from '../core/project';
import { projectFromJson, projectToJson, saveProject } from '../core/persistence';
import { useUiStore } from '../state/uiStore';
import type { PlacedImage } from '../model/types';

function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('imagen invalida'));
    img.src = src;
  });
}

export function ProjectBar({ engine }: { engine: EditorEngine }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const statusTimer = useRef<number | undefined>(undefined);
  const [status, setStatus] = useState('');

  const flash = (message: string) => {
    setStatus(message);
    window.clearTimeout(statusTimer.current);
    statusTimer.current = window.setTimeout(() => setStatus(''), 2200);
  };

  const handleSave = async () => {
    try {
      await saveProject(engine.getProject());
      flash('Proyecto guardado');
    } catch {
      flash('No se pudo guardar');
    }
  };

  const handleNew = async () => {
    const project = createProject();
    engine.loadProject(project);
    try {
      await saveProject(project);
    } catch {
      /* ignore */
    }
    flash('Proyecto nuevo');
  };

  const handleExport = () => {
    const project = engine.getProject();
    downloadText(`${project.name || 'animacion'}.anim.json`, projectToJson(project));
    flash('JSON exportado');
  };

  const handleImportJson = async (file: File) => {
    const project = projectFromJson(await file.text());
    if (!project) {
      flash('JSON inválido');
      return;
    }
    engine.loadProject(project);
    flash('Proyecto importado');
  };

  const handleImportImage = async (file: File) => {
    const { activeLayerId, currentFrame } = useUiStore.getState();
    if (!activeLayerId) {
      flash('Selecciona una capa');
      return;
    }
    try {
      const src = await readAsDataUrl(file);
      const { width, height } = await imageSize(src);
      const project = engine.getProject();
      const maxWidth = project.width * 0.5;
      const scale = width > maxWidth ? maxWidth / width : 1;
      const image: PlacedImage = {
        id: crypto.randomUUID(),
        src,
        x: project.width / 2,
        y: project.height / 2,
        width: Math.round(width * scale),
        height: Math.round(height * scale),
        rotation: 0,
      };
      engine.addImage(activeLayerId, currentFrame, image);
      flash('Imagen importada');
    } catch {
      flash('No se pudo importar la imagen');
    }
  };

  return (
    <div className="project-bar">
      <button className="tool small" onClick={handleNew}>
        Nuevo
      </button>
      <button className="tool small" onClick={handleSave}>
        Guardar
      </button>
      <button className="tool small" onClick={handleExport}>
        Exportar JSON
      </button>
      <button className="tool small" onClick={() => fileInput.current?.click()}>
        Importar JSON
      </button>
      <button className="tool small" onClick={() => imageInput.current?.click()}>
        Importar imagen
      </button>
      {status ? <span className="project-status">{status}</span> : null}
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportJson(file);
          e.target.value = '';
        }}
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportImage(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

import { useEffect, useRef } from 'react';
import type { EditorEngine } from '../core/editor';
import { renderProject, renderStroke } from '../engine/renderer';
import { useProject } from '../hooks/useProject';
import { useToolStore } from '../state/toolStore';
import { useUiStore } from '../state/uiStore';
import type { Stroke, StrokePoint } from '../model/types';

interface DrawingCanvasProps {
  engine: EditorEngine;
}

function toPoint(canvas: HTMLCanvasElement, event: PointerEvent): StrokePoint {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  return { x, y, pressure: event.pressure > 0 ? event.pressure : 0.5 };
}

export function DrawingCanvas({ engine }: DrawingCanvasProps) {
  const project = useProject(engine);
  const currentFrame = useUiStore((s) => s.currentFrame);
  const onionEnabled = useUiStore((s) => s.onionEnabled);
  const onionBefore = useUiStore((s) => s.onionBefore);
  const onionAfter = useUiStore((s) => s.onionAfter);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committedRef = useRef<HTMLCanvasElement | null>(null);
  const layerScratchRef = useRef<HTMLCanvasElement | null>(null);
  const onionScratchRef = useRef<HTMLCanvasElement | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const dirtyRef = useRef(true);

  if (committedRef.current === null) {
    const make = () => {
      const canvas = document.createElement('canvas');
      canvas.width = project.width;
      canvas.height = project.height;
      return canvas;
    };
    committedRef.current = make();
    layerScratchRef.current = make();
    onionScratchRef.current = make();
  }

  useEffect(() => {
    const committed = committedRef.current;
    const layerScratch = layerScratchRef.current;
    const onionScratch = onionScratchRef.current;
    if (!committed || !layerScratch || !onionScratch) return;

    const ctx = committed.getContext('2d');
    const layerCtx = layerScratch.getContext('2d');
    const onionCtx = onionScratch.getContext('2d');
    if (!ctx || !layerCtx || !onionCtx) return;

    if (committed.width !== project.width || committed.height !== project.height) {
      for (const canvas of [committed, layerScratch, onionScratch]) {
        canvas.width = project.width;
        canvas.height = project.height;
      }
    }

    renderProject(ctx, layerCtx, onionCtx, project, currentFrame, {
      enabled: onionEnabled,
      before: onionBefore,
      after: onionAfter,
    });
    dirtyRef.current = true;
  }, [project, currentFrame, onionEnabled, onionBefore, onionAfter]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (dirtyRef.current) {
        const canvas = canvasRef.current;
        const committed = committedRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && committed) {
          ctx.clearRect(0, 0, committed.width, committed.height);
          ctx.drawImage(committed, 0, 0);
          if (draftRef.current) renderStroke(ctx, draftRef.current);
          dirtyRef.current = false;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onDown = (event: PointerEvent) => {
      const { activeLayerId, currentFrame: frame } = useUiStore.getState();
      if (!activeLayerId || frame >= engine.getProject().layers[0].frames.length) return;
      event.preventDefault();
      canvas.setPointerCapture(event.pointerId);
      const { tool, color, size } = useToolStore.getState();
      draftRef.current = {
        id: crypto.randomUUID(),
        tool,
        color,
        size,
        points: [toPoint(canvas, event)],
      };
      dirtyRef.current = true;
    };

    const onMove = (event: PointerEvent) => {
      const draft = draftRef.current;
      if (!draft) return;
      event.preventDefault();
      const samples = event.getCoalescedEvents?.() ?? [event];
      for (const sample of samples) draft.points.push(toPoint(canvas, sample));
      dirtyRef.current = true;
    };

    const finish = (commit: boolean) => {
      const draft = draftRef.current;
      if (!draft) return;
      draftRef.current = null;
      dirtyRef.current = true;
      if (!commit || draft.points.length === 0) return;
      const { activeLayerId, currentFrame: frame } = useUiStore.getState();
      if (activeLayerId) engine.drawStroke(activeLayerId, frame, draft);
    };

    const onUp = () => finish(true);
    const onCancel = () => finish(false);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);
    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
    };
  }, [engine]);

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        width={project.width}
        height={project.height}
      />
    </div>
  );
}

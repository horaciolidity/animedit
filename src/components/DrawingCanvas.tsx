import { useEffect, useRef } from 'react';
import type { EditorEngine } from '../core/editor';
import { renderStroke, renderStrokes } from '../engine/renderer';
import { useToolStore } from '../state/toolStore';
import type { Stroke, StrokePoint } from '../model/types';

export const DOC_WIDTH = 1280;
export const DOC_HEIGHT = 720;

interface DrawingCanvasProps {
  engine: EditorEngine;
}

function toPoint(canvas: HTMLCanvasElement, event: PointerEvent): StrokePoint {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * DOC_WIDTH;
  const y = ((event.clientY - rect.top) / rect.height) * DOC_HEIGHT;
  return { x, y, pressure: event.pressure > 0 ? event.pressure : 0.5 };
}

export function DrawingCanvas({ engine }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committedRef = useRef<HTMLCanvasElement | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const dirtyRef = useRef(true);

  if (committedRef.current === null) {
    const canvas = document.createElement('canvas');
    canvas.width = DOC_WIDTH;
    canvas.height = DOC_HEIGHT;
    committedRef.current = canvas;
  }

  useEffect(() => {
    const committed = committedRef.current;
    if (!committed) return;
    const redraw = () => {
      const ctx = committed.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, DOC_WIDTH, DOC_HEIGHT);
      renderStrokes(ctx, engine.getStrokes());
      dirtyRef.current = true;
    };
    redraw();
    return engine.subscribe(redraw);
  }, [engine]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (dirtyRef.current) {
        const canvas = canvasRef.current;
        const committed = committedRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && committed) {
          ctx.clearRect(0, 0, DOC_WIDTH, DOC_HEIGHT);
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
      if (commit && draft.points.length > 0) engine.addStroke(draft);
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
      <canvas ref={canvasRef} className="drawing-canvas" width={DOC_WIDTH} height={DOC_HEIGHT} />
    </div>
  );
}

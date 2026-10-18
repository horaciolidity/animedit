import { useEffect, useRef, useState } from 'react';
import type { EditorEngine } from '../core/editor';
import { renderProject, renderStroke } from '../engine/renderer';
import { subscribeImages } from '../engine/imageCache';
import { layerBounds, parentWorldMatrix, transformAt, worldMatrix } from '../core/transform';
import { buildShape, isShapeKind, type ShapeKind } from '../core/shapes';
import { useProject } from '../hooks/useProject';
import { useToolStore } from '../state/toolStore';
import { useUiStore } from '../state/uiStore';
import type { Stroke, StrokePoint, ToolKind, Transform } from '../model/types';

interface DrawingCanvasProps {
  engine: EditorEngine;
}

interface MoveSession {
  start: StrokePoint;
  transform: Transform;
  parentWorld: DOMMatrix;
}

interface ShapeSession {
  kind: ShapeKind;
  start: StrokePoint;
}

interface PanSession {
  startX: number;
  startY: number;
  panX: number;
  panY: number;
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
  const zoom = useUiStore((s) => s.zoom);
  const panX = useUiStore((s) => s.panX);
  const panY = useUiStore((s) => s.panY);
  const tool = useToolStore((s) => s.tool);

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const committedRef = useRef<HTMLCanvasElement | null>(null);
  const layerScratchRef = useRef<HTMLCanvasElement | null>(null);
  const onionScratchRef = useRef<HTMLCanvasElement | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const moveRef = useRef<MoveSession | null>(null);
  const shapeRef = useRef<ShapeSession | null>(null);
  const panRef = useRef<PanSession | null>(null);
  const dirtyRef = useRef(true);
  const [imagesVersion, setImagesVersion] = useState(0);

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

  useEffect(() => subscribeImages(() => setImagesVersion((v) => v + 1)), []);

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
  }, [project, currentFrame, onionEnabled, onionBefore, onionAfter, imagesVersion]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (dirtyRef.current) {
        const canvas = canvasRef.current;
        const committed = committedRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx && committed) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
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
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const state = useUiStore.getState();
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.0015);
        state.zoomAt(
          factor,
          event.clientX - rect.left,
          event.clientY - rect.top,
          rect.width,
          rect.height,
        );
      } else {
        state.setPan(state.panX - event.deltaX, state.panY - event.deltaY);
      }
    };
    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startDraw = (event: PointerEvent, kind: ToolKind) => {
      const { activeLayerId, currentFrame: frame } = useUiStore.getState();
      if (!activeLayerId || frame >= engine.getProject().layers[0].frames.length) return;
      const { color, size } = useToolStore.getState();
      draftRef.current = {
        id: crypto.randomUUID(),
        tool: kind,
        color,
        size,
        points: [toPoint(canvas, event)],
      };
      dirtyRef.current = true;
    };

    const startShape = (event: PointerEvent, kind: ShapeKind) => {
      const { activeLayerId, currentFrame: frame } = useUiStore.getState();
      if (!activeLayerId || frame >= engine.getProject().layers[0].frames.length) return;
      const { color, size } = useToolStore.getState();
      const start = toPoint(canvas, event);
      shapeRef.current = { kind, start };
      draftRef.current = {
        id: crypto.randomUUID(),
        tool: kind,
        color,
        size,
        points: buildShape(kind, start, start, event.shiftKey),
      };
      dirtyRef.current = true;
    };

    const startMove = (event: PointerEvent) => {
      const { activeLayerId, currentFrame: frame } = useUiStore.getState();
      const current = engine.getProject();
      const layer = current.layers.find((candidate) => candidate.id === activeLayerId);
      if (!layer) return;

      const point = toPoint(canvas, event);
      const local = worldMatrix(current, layer, frame)
        .inverse()
        .transformPoint({ x: point.x, y: point.y });
      const bounds = layerBounds(layer);
      if (!bounds) return;
      const margin = 14;
      if (
        local.x < bounds.minX - margin ||
        local.x > bounds.maxX + margin ||
        local.y < bounds.minY - margin ||
        local.y > bounds.maxY + margin
      ) {
        return;
      }

      moveRef.current = {
        start: point,
        transform: transformAt(layer, frame),
        parentWorld: parentWorldMatrix(current, layer, frame),
      };
      engine.beginTransform();
    };

    const onDown = (event: PointerEvent) => {
      event.preventDefault();
      if (event.button === 1) {
        const state = useUiStore.getState();
        panRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          panX: state.panX,
          panY: state.panY,
        };
        canvas.setPointerCapture(event.pointerId);
        return;
      }
      canvas.setPointerCapture(event.pointerId);
      const activeTool = useToolStore.getState().tool;
      if (activeTool === 'move') startMove(event);
      else if (isShapeKind(activeTool)) startShape(event, activeTool);
      else startDraw(event, activeTool);
    };

    const onMove = (event: PointerEvent) => {
      const pan = panRef.current;
      if (pan) {
        event.preventDefault();
        useUiStore
          .getState()
          .setPan(pan.panX + (event.clientX - pan.startX), pan.panY + (event.clientY - pan.startY));
        return;
      }

      const move = moveRef.current;
      if (move) {
        event.preventDefault();
        const { activeLayerId, currentFrame: frame } = useUiStore.getState();
        if (!activeLayerId) return;
        const point = toPoint(canvas, event);
        const inverse = move.parentWorld.inverse();
        const p0 = inverse.transformPoint({ x: move.start.x, y: move.start.y });
        const p1 = inverse.transformPoint({ x: point.x, y: point.y });
        engine.updateLiveTransform(activeLayerId, frame, {
          ...move.transform,
          x: move.transform.x + (p1.x - p0.x),
          y: move.transform.y + (p1.y - p0.y),
        });
        return;
      }

      const shape = shapeRef.current;
      if (shape && draftRef.current) {
        event.preventDefault();
        const current = toPoint(canvas, event);
        draftRef.current = {
          ...draftRef.current,
          points: buildShape(shape.kind, shape.start, current, event.shiftKey),
        };
        dirtyRef.current = true;
        return;
      }

      const draft = draftRef.current;
      if (!draft) return;
      event.preventDefault();
      const samples = event.getCoalescedEvents?.() ?? [event];
      for (const sample of samples) draft.points.push(toPoint(canvas, sample));
      dirtyRef.current = true;
    };

    const finishDraw = (commit: boolean) => {
      const draft = draftRef.current;
      if (!draft) return;
      draftRef.current = null;
      dirtyRef.current = true;
      if (!commit || draft.points.length < 2) return;
      const { activeLayerId, currentFrame: frame } = useUiStore.getState();
      if (activeLayerId) engine.drawStroke(activeLayerId, frame, draft);
    };

    const onUp = () => {
      if (panRef.current) {
        panRef.current = null;
      } else if (moveRef.current) {
        moveRef.current = null;
        engine.endTransform();
      } else if (shapeRef.current) {
        shapeRef.current = null;
        finishDraw(true);
      } else {
        finishDraw(true);
      }
    };

    const onCancel = () => {
      panRef.current = null;
      if (moveRef.current) {
        moveRef.current = null;
        engine.endTransform();
      } else {
        shapeRef.current = null;
        finishDraw(false);
      }
    };

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

  const cursor = tool === 'move' ? 'move' : 'crosshair';

  return (
    <div className="canvas-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          cursor,
        }}
        width={project.width}
        height={project.height}
      />
    </div>
  );
}

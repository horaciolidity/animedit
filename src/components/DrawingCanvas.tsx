import { useEffect, useRef, useState } from 'react';
import type { EditorEngine } from '../core/editor';
import { renderProject, renderStroke } from '../engine/renderer';
import { subscribeImages } from '../engine/imageCache';
import {
  layerBounds,
  localMatrix,
  parentWorldMatrix,
  transformAt,
  worldMatrix,
} from '../core/transform';
import { buildShape, isShapeKind, type ShapeKind } from '../core/shapes';
import { useProject } from '../hooks/useProject';
import { useToolStore } from '../state/toolStore';
import { useUiStore } from '../state/uiStore';
import type { Layer, Stroke, StrokePoint, ToolKind, Transform } from '../model/types';

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

interface GizmoSession {
  mode: 'move' | 'scale' | 'rotate';
  start: StrokePoint;
  startTransform: Transform;
  startBounds: { minX: number; minY: number; maxX: number; maxY: number };
  center: { x: number; y: number };
  handle: 'nw' | 'ne' | 'sw' | 'se' | 'center' | 'rotate';
}

function toPoint(canvas: HTMLCanvasElement, event: PointerEvent): StrokePoint {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  return { x, y, pressure: event.pressure > 0 ? event.pressure : 0.5 };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getScreenBounds(layer: Layer, frameIndex: number, engine: EditorEngine): { x: number; y: number; w: number; h: number } | null {
  const bounds = layerBounds(layer);
  if (!bounds) return null;
  const current = engine.getProject();
  const m = worldMatrix(current, layer, frameIndex);
  const corners: { x: number; y: number }[] = [
    m.transformPoint({ x: bounds.minX, y: bounds.minY }),
    m.transformPoint({ x: bounds.maxX, y: bounds.minY }),
    m.transformPoint({ x: bounds.maxX, y: bounds.maxY }),
    m.transformPoint({ x: bounds.minX, y: bounds.maxY }),
  ];
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
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
  const gizmoRef = useRef<GizmoSession | null>(null);
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
          if (tool === 'move') drawGizmo(ctx);
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

  function drawGizmo(ctx: CanvasRenderingContext2D): void {
    const { activeLayerId } = useUiStore.getState();
    if (!activeLayerId) return;
    const current = engine.getProject();
    const layer = current.layers.find((candidate) => candidate.id === activeLayerId);
    if (!layer) return;

    const screen = getScreenBounds(layer, currentFrame, engine);
    if (!screen) return;

    const cx = screen.x + screen.w / 2;
    const cy = screen.y + screen.h / 2;
    const handleSize = 8 / zoom;
    const ctxSave = ctx.getTransform();

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = '#4a7dff';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeRect(screen.x, screen.y, screen.w, screen.h);
    ctx.setLineDash([]);

    const handles: { x: number; y: number }[] = [
      { x: screen.x, y: screen.y },
      { x: screen.x + screen.w, y: screen.y },
      { x: screen.x, y: screen.y + screen.h },
      { x: screen.x + screen.w, y: screen.y + screen.h },
      { x: cx, y: cy },
    ];

    for (const h of handles) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, handleSize, 0, Math.PI * 2);
      ctx.fillStyle = '#4a7dff';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1 / zoom;
      ctx.stroke();
    }

    const rotX = cx;
    const rotY = cy - screen.h / 2 - 14 / zoom;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(rotX, rotY);
    ctx.strokeStyle = '#4a7dff';
    ctx.lineWidth = 2 / zoom;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rotX, rotY, handleSize, 0, Math.PI * 2);
    ctx.fillStyle = '#4a7dff';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    ctx.restore();
    ctx.setTransform(ctxSave);
  }

  function getHandleAt(
    screen: { x: number; y: number; w: number; h: number },
    pointer: { x: number; y: number },
  ): 'nw' | 'ne' | 'sw' | 'se' | 'center' | 'rotate' | null {
    const cx = screen.x + screen.w / 2;
    const cy = screen.y + screen.h / 2;
    const hit = 14 / zoom;
    if (dist(pointer, { x: screen.x, y: screen.y }) < hit) return 'nw';
    if (dist(pointer, { x: screen.x + screen.w, y: screen.y }) < hit) return 'ne';
    if (dist(pointer, { x: screen.x, y: screen.y + screen.h }) < hit) return 'sw';
    if (dist(pointer, { x: screen.x + screen.w, y: screen.y + screen.h }) < hit) return 'se';
    if (dist(pointer, { x: cx, y: cy }) < hit) return 'center';
    const rotX = cx;
    const rotY = cy - screen.h / 2 - 14 / zoom;
    if (dist(pointer, { x: rotX, y: rotY }) < hit) return 'rotate';
    return null;
  }

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

    const startGizmo = (event: PointerEvent, handle: 'nw' | 'ne' | 'sw' | 'se' | 'center' | 'rotate'): boolean => {
      const { activeLayerId, currentFrame: frame } = useUiStore.getState();
      const current = engine.getProject();
      const layer = current.layers.find((candidate) => candidate.id === activeLayerId);
      if (!layer) return false;

      const screen = getScreenBounds(layer, frame, engine);
      if (!screen) return false;

      const start = toPoint(canvas, event);
      const transform = transformAt(layer, frame);
      const bounds = layerBounds(layer);
      if (!bounds) return false;

      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;

      gizmoRef.current = {
        mode: handle === 'rotate' ? 'rotate' : handle === 'center' ? 'move' : 'scale',
        start,
        startTransform: { ...transform },
        startBounds: bounds,
        center: { x: centerX, y: centerY },
        handle,
      };
      engine.beginTransform();
      dirtyRef.current = true;
      return true;
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
      if (activeTool === 'move') {
        const { activeLayerId, currentFrame: frame } = useUiStore.getState();
        const current = engine.getProject();
        const layer = current.layers.find((candidate) => candidate.id === activeLayerId);
        const screen = layer ? getScreenBounds(layer, frame, engine) : null;
        const pointer = toPoint(canvas, event);
        if (screen && tool === 'move') {
          const handle = getHandleAt(screen, pointer);
          if (handle) {
            startGizmo(event, handle);
            return;
          }
        }
        startMove(event);
      } else if (isShapeKind(activeTool)) {
        startShape(event, activeTool);
      } else {
        startDraw(event, activeTool);
      }
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

      const gizmo = gizmoRef.current;
      if (gizmo) {
        event.preventDefault();
        const { activeLayerId, currentFrame: frame } = useUiStore.getState();
        if (!activeLayerId) return;
        const current = engine.getProject();
        const layer = current.layers.find((candidate) => candidate.id === activeLayerId);
        if (!layer) return;
        const point = toPoint(canvas, event);

        const dx = point.x - gizmo.start.x;
        const dy = point.y - gizmo.start.y;
        const parentWorld = parentWorldMatrix(current, layer, frame);
        const invParent = parentWorld.inverse();

        if (gizmo.mode === 'move') {
          const dLocal = invParent.transformPoint({ x: dx, y: dy });
          const dOrigin = invParent.transformPoint({ x: 0, y: 0 });
          engine.updateLiveTransform(activeLayerId, frame, {
            ...gizmo.startTransform,
            x: gizmo.startTransform.x + (dLocal.x - dOrigin.x),
            y: gizmo.startTransform.y + (dLocal.y - dOrigin.y),
          });
        } else if (gizmo.mode === 'scale') {
          const centerWorld = localMatrix(gizmo.startTransform, gizmo.center.x, gizmo.center.y)
            .multiply(parentWorld);
          const invCenterWorld = centerWorld.inverse();
          const startCornerWorld = centerWorld.transformPoint({
            x: gizmo.handle === 'nw' || gizmo.handle === 'sw' ? gizmo.startBounds.minX : gizmo.startBounds.maxX,
            y: gizmo.handle === 'nw' || gizmo.handle === 'ne' ? gizmo.startBounds.minY : gizmo.startBounds.maxY,
          });
          const currentCornerLocal = invCenterWorld.transformPoint(point);
          const startCornerLocal = invCenterWorld.transformPoint(startCornerWorld);
          const startDist = dist({ x: 0, y: 0 }, startCornerLocal);
          const curDist = dist({ x: 0, y: 0 }, currentCornerLocal);
          const scale = startDist > 0 ? curDist / startDist : 1;
          const sx = gizmo.handle === 'nw' || gizmo.handle === 'sw' ? -scale : scale;
          const sy = gizmo.handle === 'nw' || gizmo.handle === 'ne' ? -scale : scale;
          engine.updateLiveTransform(activeLayerId, frame, {
            ...gizmo.startTransform,
            scaleX: Math.max(0.05, gizmo.startTransform.scaleX * Math.abs(sx)),
            scaleY: Math.max(0.05, gizmo.startTransform.scaleY * Math.abs(sy)),
          });
        } else if (gizmo.mode === 'rotate') {
          const centerWorld = localMatrix(gizmo.startTransform, gizmo.center.x, gizmo.center.y)
            .multiply(parentWorld);
          const invCenterWorld = centerWorld.inverse();
          const startAngle = Math.atan2(
            gizmo.start.y - gizmo.center.y,
            gizmo.start.x - gizmo.center.x,
          );
          const curAngle = Math.atan2(
            invCenterWorld.transformPoint(point).y,
            invCenterWorld.transformPoint(point).x,
          );
          const delta = curAngle - startAngle;
          engine.updateLiveTransform(activeLayerId, frame, {
            ...gizmo.startTransform,
            rotation: gizmo.startTransform.rotation + (delta * 180) / Math.PI,
          });
        }
        dirtyRef.current = true;
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
      } else if (gizmoRef.current) {
        gizmoRef.current = null;
        engine.endTransform();
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
      gizmoRef.current = null;
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

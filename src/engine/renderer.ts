import type { Project, Stroke } from '../model/types';
import { worldMatrix, localMatrix } from '../core/transform';
import { resolveFrameIndex, cameraAt } from '../core/project';
import { getImage } from './imageCache';

export interface OnionSkin {
  enabled: boolean;
  before: number;
  after: number;
}

function strokeWidth(stroke: Stroke, pressure: number): number {
  const p = pressure > 0 ? Math.min(pressure, 1) : 1;
  return Math.max(0.5, stroke.size * p);
}

export function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const pts = stroke.points;
  if (pts.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (stroke.tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.fillStyle = 'rgba(0,0,0,1)';
  } else {
    ctx.strokeStyle = stroke.color;
    ctx.fillStyle = stroke.color;
  }

  if (pts.length === 1) {
    const p = pts[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, strokeWidth(stroke, p.pressure) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    ctx.beginPath();
    ctx.lineWidth = (strokeWidth(stroke, a.pressure) + strokeWidth(stroke, b.pressure)) / 2;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.restore();
}

export function renderStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[]): void {
  for (const stroke of strokes) renderStroke(ctx, stroke);
}

function renderFrame(
  target: CanvasRenderingContext2D,
  layerScratch: CanvasRenderingContext2D,
  project: Project,
  frameIndex: number,
): void {
  const { width, height } = project;
  const pivotX = width / 2;
  const pivotY = height / 2;

  const camTransform = cameraAt(project.camera, frameIndex);
  const camMatrix = localMatrix(camTransform, pivotX, pivotY);
  const invCam = camMatrix.inverse();

  target.setTransform(1, 0, 0, 1, 0, 0);
  target.clearRect(0, 0, width, height);

  for (const layer of project.layers) {
    if (!layer.visible) continue;
    const sourceIndex = resolveFrameIndex(layer, frameIndex);
    const frame = layer.frames[sourceIndex];
    const hasStrokes = !!frame && frame.strokes.length > 0;
    const hasImages = !!frame && frame.images.length > 0;
    if (!hasStrokes && !hasImages) continue;

    layerScratch.setTransform(1, 0, 0, 1, 0, 0);
    layerScratch.clearRect(0, 0, width, height);

    if (frame.images.length > 0) {
      for (const image of frame.images) {
        const element = getImage(image.src);
        if (!element) continue;
        layerScratch.save();
        layerScratch.translate(image.x, image.y);
        if (image.rotation) layerScratch.rotate((image.rotation * Math.PI) / 180);
        layerScratch.drawImage(
          element,
          -image.width / 2,
          -image.height / 2,
          image.width,
          image.height,
        );
        layerScratch.restore();
      }
    }

    renderStrokes(layerScratch, frame.strokes);

    target.save();
    target.globalAlpha = layer.opacity;
    target.setTransform(invCam.multiply(worldMatrix(project, layer, frameIndex)));
    target.drawImage(layerScratch.canvas, 0, 0);
    target.restore();
  }
}

function drawOnionFrame(
  target: CanvasRenderingContext2D,
  layerScratch: CanvasRenderingContext2D,
  onionScratch: CanvasRenderingContext2D,
  project: Project,
  frameIndex: number,
  tint: string,
  distance: number,
): void {
  if (frameIndex < 0 || frameIndex >= project.layers[0].frames.length) return;

  renderFrame(onionScratch, layerScratch, project, frameIndex);

  onionScratch.save();
  onionScratch.setTransform(1, 0, 0, 1, 0, 0);
  onionScratch.globalCompositeOperation = 'source-atop';
  onionScratch.fillStyle = tint;
  onionScratch.fillRect(0, 0, project.width, project.height);
  onionScratch.restore();

  target.save();
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.globalAlpha = Math.min(0.4, 0.4 / distance);
  target.drawImage(onionScratch.canvas, 0, 0);
  target.restore();
}

export function renderProject(
  target: CanvasRenderingContext2D,
  layerScratch: CanvasRenderingContext2D,
  onionScratch: CanvasRenderingContext2D,
  project: Project,
  frameIndex: number,
  onion: OnionSkin,
): void {
  target.setTransform(1, 0, 0, 1, 0, 0);
  target.clearRect(0, 0, project.width, project.height);

  if (onion.enabled) {
    for (let d = onion.before; d >= 1; d--) {
      drawOnionFrame(target, layerScratch, onionScratch, project, frameIndex - d, '#ff5b5b', d);
    }
    for (let d = onion.after; d >= 1; d--) {
      drawOnionFrame(target, layerScratch, onionScratch, project, frameIndex + d, '#5b8cff', d);
    }
  }

  renderFrame(target, layerScratch, project, frameIndex);
}

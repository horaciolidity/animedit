import type { Stroke } from '../model/types';

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

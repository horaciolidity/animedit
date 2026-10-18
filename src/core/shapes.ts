import type { StrokePoint } from '../model/types';

export type ShapeKind = 'line' | 'rect' | 'ellipse';

export const SHAPE_KINDS: ShapeKind[] = ['line', 'rect', 'ellipse'];

export function isShapeKind(value: string): value is ShapeKind {
  return value === 'line' || value === 'rect' || value === 'ellipse';
}

function point(x: number, y: number): StrokePoint {
  return { x, y, pressure: 0.5 };
}

function squareEnd(start: StrokePoint, end: StrokePoint): StrokePoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return point(
    start.x + (dx < 0 ? -size : size),
    start.y + (dy < 0 ? -size : size),
  );
}

export function buildShape(
  kind: ShapeKind,
  start: StrokePoint,
  end: StrokePoint,
  constrain: boolean,
): StrokePoint[] {
  if (kind === 'line') {
    let target = end;
    if (constrain) {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const step = Math.PI / 4;
      const angle = Math.round(Math.atan2(dy, dx) / step) * step;
      const length = Math.hypot(dx, dy);
      target = point(start.x + Math.cos(angle) * length, start.y + Math.sin(angle) * length);
    }
    return [point(start.x, start.y), point(target.x, target.y)];
  }

  const corner = constrain ? squareEnd(start, end) : end;

  if (kind === 'rect') {
    return [
      point(start.x, start.y),
      point(corner.x, start.y),
      point(corner.x, corner.y),
      point(start.x, corner.y),
      point(start.x, start.y),
    ];
  }

  const cx = (start.x + corner.x) / 2;
  const cy = (start.y + corner.y) / 2;
  const rx = Math.abs(corner.x - start.x) / 2;
  const ry = Math.abs(corner.y - start.y) / 2;
  const segments = 56;
  const points: StrokePoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(point(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry));
  }
  return points;
}

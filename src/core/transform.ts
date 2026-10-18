import type { EasingKind, Layer, Project, Transform } from '../model/types';

export const IDENTITY: Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

export function ease(kind: EasingKind, t: number): number {
  const c = Math.min(1, Math.max(0, t));
  switch (kind) {
    case 'linear':
      return c;
    case 'easeIn':
      return c * c;
    case 'easeOut':
      return c * (2 - c);
    case 'easeInOut':
      return c < 0.5 ? 2 * c * c : -1 + (4 - 2 * c) * c;
    case 'step':
      return 0;
    default:
      return c;
  }
}

export function lerpTransform(a: Transform, b: Transform, t: number): Transform {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    rotation: a.rotation + (b.rotation - a.rotation) * t,
    scaleX: a.scaleX + (b.scaleX - a.scaleX) * t,
    scaleY: a.scaleY + (b.scaleY - a.scaleY) * t,
  };
}

export function transformAt(layer: Layer, frame: number): Transform {
  const keys = layer.keyframes;
  if (keys.length === 0) return layer.transform;
  if (frame <= keys[0].frame) return keys[0].transform;
  const last = keys[keys.length - 1];
  if (frame >= last.frame) return last.transform;

  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frame >= a.frame && frame <= b.frame) {
      const span = b.frame - a.frame || 1;
      const t = ease(a.easing, (frame - a.frame) / span);
      return lerpTransform(a.transform, b.transform, t);
    }
  }
  return last.transform;
}

export function localMatrix(transform: Transform, pivotX: number, pivotY: number): DOMMatrix {
  const matrix = new DOMMatrix();
  matrix.translateSelf(pivotX + transform.x, pivotY + transform.y);
  matrix.rotateSelf(transform.rotation);
  matrix.scaleSelf(transform.scaleX, transform.scaleY);
  matrix.translateSelf(-pivotX, -pivotY);
  return matrix;
}

function findParent(project: Project, layer: Layer): Layer | null {
  if (!layer.parentId) return null;
  return project.layers.find((candidate) => candidate.id === layer.parentId) ?? null;
}

export function worldMatrix(project: Project, layer: Layer, frame: number): DOMMatrix {
  const pivotX = project.width / 2;
  const pivotY = project.height / 2;

  const chain: Layer[] = [];
  const seen = new Set<string>();
  let current: Layer | null = layer;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = findParent(project, current);
  }

  let matrix = new DOMMatrix();
  for (const item of chain) {
    matrix = matrix.multiply(localMatrix(transformAt(item, frame), pivotX, pivotY));
  }
  return matrix;
}

export function parentWorldMatrix(project: Project, layer: Layer, frame: number): DOMMatrix {
  const parent = findParent(project, layer);
  return parent ? worldMatrix(project, parent, frame) : new DOMMatrix();
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function layerBounds(layer: Layer): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let found = false;

  for (const frame of layer.frames) {
    for (const stroke of frame.strokes) {
      for (const point of stroke.points) {
        found = true;
        if (point.x < minX) minX = point.x;
        if (point.y < minY) minY = point.y;
        if (point.x > maxX) maxX = point.x;
        if (point.y > maxY) maxY = point.y;
      }
    }
  }

  return found ? { minX, minY, maxX, maxY } : null;
}

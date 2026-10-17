export type ToolKind = 'brush' | 'eraser';

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

export interface Stroke {
  id: string;
  tool: ToolKind;
  color: string;
  size: number;
  points: StrokePoint[];
}

export interface DocumentSize {
  width: number;
  height: number;
}

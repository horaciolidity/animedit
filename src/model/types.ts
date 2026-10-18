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

export interface Frame {
  strokes: Stroke[];
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  frames: Frame[];
}

export interface Project {
  id: string;
  width: number;
  height: number;
  fps: number;
  layers: Layer[];
}

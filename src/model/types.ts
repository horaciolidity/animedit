export type ToolKind = 'brush' | 'eraser';

export type EditorTool = ToolKind | 'move';

export type EasingKind = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step';

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

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface Keyframe {
  frame: number;
  transform: Transform;
  easing: EasingKind;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  parentId: string | null;
  transform: Transform;
  keyframes: Keyframe[];
  frames: Frame[];
}

export interface Project {
  id: string;
  width: number;
  height: number;
  fps: number;
  layers: Layer[];
}

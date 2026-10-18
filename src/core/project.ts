import type { Frame, Layer, Project, Stroke } from '../model/types';

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createFrame(): Frame {
  return { strokes: [] };
}

export function createLayer(name: string, frameCount: number): Layer {
  return {
    id: createId('layer'),
    name,
    visible: true,
    opacity: 1,
    frames: Array.from({ length: frameCount }, createFrame),
  };
}

export function getFrameCount(project: Project): number {
  return project.layers.length > 0 ? project.layers[0].frames.length : 0;
}

export function createProject(width = 1280, height = 720, fps = 12): Project {
  return {
    id: createId('project'),
    width,
    height,
    fps,
    layers: [createLayer('Capa 1', 1)],
  };
}

export function updateLayer(
  project: Project,
  layerId: string,
  updater: (layer: Layer) => Layer,
): Project {
  return {
    ...project,
    layers: project.layers.map((layer) => (layer.id === layerId ? updater(layer) : layer)),
  };
}

export function addStroke(
  project: Project,
  layerId: string,
  frameIndex: number,
  stroke: Stroke,
): Project {
  return updateLayer(project, layerId, (layer) => ({
    ...layer,
    frames: layer.frames.map((frame, index) =>
      index === frameIndex ? { strokes: [...frame.strokes, stroke] } : frame,
    ),
  }));
}

export function addLayer(project: Project): Project {
  const layer = createLayer(`Capa ${project.layers.length + 1}`, getFrameCount(project));
  return { ...project, layers: [...project.layers, layer] };
}

export function removeLayer(project: Project, layerId: string): Project {
  if (project.layers.length <= 1) return project;
  return { ...project, layers: project.layers.filter((layer) => layer.id !== layerId) };
}

export function moveLayer(project: Project, layerId: string, direction: -1 | 1): Project {
  const index = project.layers.findIndex((layer) => layer.id === layerId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= project.layers.length) return project;
  const layers = [...project.layers];
  const current = layers[index];
  layers[index] = layers[target];
  layers[target] = current;
  return { ...project, layers };
}

export function appendFrame(project: Project): Project {
  return {
    ...project,
    layers: project.layers.map((layer) => ({ ...layer, frames: [...layer.frames, createFrame()] })),
  };
}

export function insertFrameAfter(project: Project, index: number, copyLayerId?: string): Project {
  return {
    ...project,
    layers: project.layers.map((layer) => {
      const frames = [...layer.frames];
      const source = frames[index];
      const copy = layer.id === copyLayerId && source ? source.strokes.map((s) => ({ ...s })) : [];
      frames.splice(index + 1, 0, { strokes: copy });
      return { ...layer, frames };
    }),
  };
}

export function removeFrame(project: Project, index: number): Project {
  if (getFrameCount(project) <= 1) return project;
  return {
    ...project,
    layers: project.layers.map((layer) => ({
      ...layer,
      frames: layer.frames.filter((_, i) => i !== index),
    })),
  };
}

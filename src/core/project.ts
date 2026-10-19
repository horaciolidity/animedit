import type {
  Camera,
  EasingKind,
  Frame,
  Keyframe,
  Layer,
  PlacedImage,
  Project,
  Stroke,
  Transform,
} from '../model/types';
import { IDENTITY, ease, lerpTransform, transformAt } from './transform';

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function createFrame(): Frame {
  return { strokes: [], images: [], exposure: 1 };
}

export function createLayer(name: string, frameCount: number): Layer {
  return {
    id: createId('layer'),
    name,
    visible: true,
    opacity: 1,
    parentId: null,
    transform: { ...IDENTITY },
    keyframes: [],
    frames: Array.from({ length: frameCount }, createFrame),
  };
}

export function getFrameCount(project: Project): number {
  return project.layers.length > 0 ? project.layers[0].frames.length : 0;
}

export function createProject(width = 1280, height = 720, fps = 12): Project {
  return {
    id: createId('project'),
    name: 'Animación',
    width,
    height,
    fps,
    camera: { transform: { ...IDENTITY }, keyframes: [] },
    layers: [createLayer('Capa 1', 1)],
  };
}

export function setFps(project: Project, fps: number): Project {
  return { ...project, fps: Math.max(1, Math.floor(fps)) };
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

export function resolveFrameIndex(layer: Layer, frameIndex: number): number {
  const frames = layer.frames;
  for (let i = frameIndex; i >= 0; i--) {
    const f = frames[i];
    const exp = Math.max(1, f.exposure);
    if (i + exp > frameIndex) return i;
  }
  return frameIndex;
}

export function addStroke(
  project: Project,
  layerId: string,
  frameIndex: number,
  stroke: Stroke,
): Project {
  return updateLayer(project, layerId, (layer) => {
    const sourceIndex = resolveFrameIndex(layer, frameIndex);
    return {
      ...layer,
      frames: layer.frames.map((frame, index) =>
        index === sourceIndex ? { ...frame, strokes: [...frame.strokes, stroke] } : frame,
      ),
    };
  });
}

export function addImage(
  project: Project,
  layerId: string,
  frameIndex: number,
  image: PlacedImage,
): Project {
  return updateLayer(project, layerId, (layer) => ({
    ...layer,
    frames: layer.frames.map((frame, index) =>
      index === frameIndex ? { ...frame, images: [...frame.images, image] } : frame,
    ),
  }));
}
export function addLayer(project: Project): Project {
  const layer = createLayer(`Capa ${project.layers.length + 1}`, getFrameCount(project));
  return { ...project, layers: [...project.layers, layer] };
}

export function clearFrame(project: Project, layerId: string, frameIndex: number): Project {
  return updateLayer(project, layerId, (layer) => {
    const sourceIndex = resolveFrameIndex(layer, frameIndex);

    if (sourceIndex !== frameIndex) {
      const newPrevExp = Math.max(1, frameIndex - sourceIndex);
      return {
        ...layer,
        frames: layer.frames.map((f, i) => {
          if (i === sourceIndex) return { ...f, exposure: newPrevExp };
          if (i === frameIndex) return createFrame();
          return f;
        }),
      };
    }

    return {
      ...layer,
      frames: layer.frames.map((frame, index) =>
        index === frameIndex ? { ...frame, strokes: [], images: [] } : frame,
      ),
    };
  });
}

export function removeLayer(project: Project, layerId: string): Project {
  if (project.layers.length <= 1) return project;
  const layers = project.layers
    .filter((layer) => layer.id !== layerId)
    .map((layer) => (layer.parentId === layerId ? { ...layer, parentId: null } : layer));
  return { ...project, layers };
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

export function setParent(project: Project, layerId: string, parentId: string | null): Project {
  if (layerId === parentId) return project;
  if (parentId && isDescendant(project, parentId, layerId)) return project;
  return updateLayer(project, layerId, (layer) => ({ ...layer, parentId }));
}

function isDescendant(project: Project, candidateId: string, ancestorId: string): boolean {
  const seen = new Set<string>();
  let current = project.layers.find((layer) => layer.id === candidateId);
  while (current?.parentId && !seen.has(current.id)) {
    if (current.parentId === ancestorId) return true;
    seen.add(current.id);
    current = project.layers.find((layer) => layer.id === current?.parentId);
  }
  return false;
}

function sortKeyframes(keyframes: Keyframe[]): Keyframe[] {
  return [...keyframes].sort((a, b) => a.frame - b.frame);
}

export function setTransformAtFrame(
  project: Project,
  layerId: string,
  frame: number,
  transform: Transform,
): Project {
  return updateLayer(project, layerId, (layer) => {
    if (layer.keyframes.length === 0) return { ...layer, transform };
    const exists = layer.keyframes.some((key) => key.frame === frame);
    const keyframes = exists
      ? layer.keyframes.map((key) => (key.frame === frame ? { ...key, transform } : key))
      : sortKeyframes([...layer.keyframes, { frame, transform, easing: 'linear' }]);
    return { ...layer, keyframes };
  });
}

export function addKeyframeAt(project: Project, layerId: string, frame: number): Project {
  return updateLayer(project, layerId, (layer) => {
    if (layer.keyframes.some((key) => key.frame === frame)) return layer;
    const transform = transformAt(layer, frame);
    return { ...layer, keyframes: sortKeyframes([...layer.keyframes, { frame, transform, easing: 'linear' }]) };
  });
}

export function removeKeyframeAt(project: Project, layerId: string, frame: number): Project {
  return updateLayer(project, layerId, (layer) => ({
    ...layer,
    keyframes: layer.keyframes.filter((key) => key.frame !== frame),
  }));
}

export function setKeyframeEasing(
  project: Project,
  layerId: string,
  frame: number,
  easing: EasingKind,
): Project {
  return updateLayer(project, layerId, (layer) => ({
    ...layer,
    keyframes: layer.keyframes.map((key) => (key.frame === frame ? { ...key, easing } : key)),
  }));
}

function interpolateKeys(keys: Keyframe[], frameIndex: number): Transform | null {
  if (keys.length === 0) return null;
  if (frameIndex <= keys[0].frame) return keys[0].transform;
  const last = keys[keys.length - 1];
  if (frameIndex >= last.frame) return last.transform;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i];
    const b = keys[i + 1];
    if (frameIndex >= a.frame && frameIndex <= b.frame) {
      const span = b.frame - a.frame || 1;
      const t = ease(a.easing, (frameIndex - a.frame) / span);
      return lerpTransform(a.transform, b.transform, t);
    }
  }
  return null;
}

export function cameraAt(camera: Camera, frame: number): Transform {
  return interpolateKeys(camera.keyframes, frame) ?? camera.transform;
}

export function setCameraTransformAtFrame(project: Project, frame: number, transform: Transform): Project {
  return {
    ...project,
    camera: {
      ...project.camera,
      keyframes: setCameraKeyframeList(project.camera.keyframes, frame, transform),
    },
  };
}

function setCameraKeyframeList(keys: Keyframe[], frame: number, transform: Transform): Keyframe[] {
  const exists = keys.some((key) => key.frame === frame);
  const updated = exists
    ? keys.map((key) => (key.frame === frame ? { ...key, transform } : key))
    : sortKeyframes([...keys, { frame, transform, easing: 'linear' }]);
  return updated;
}

export function addCameraKeyframeAt(project: Project, frame: number): Project {
  return {
    ...project,
    camera: {
      ...project.camera,
      keyframes: addKeyframeList(project.camera.keyframes, project.camera, frame),
    },
  };
}

function addKeyframeList(keys: Keyframe[], camera: Camera, frame: number): Keyframe[] {
  if (keys.some((key) => key.frame === frame)) return keys;
  const transform = cameraAt(camera, frame);
  return sortKeyframes([...keys, { frame, transform, easing: 'linear' }]);
}

export function removeCameraKeyframeAt(project: Project, frame: number): Project {
  return {
    ...project,
    camera: {
      ...project.camera,
      keyframes: project.camera.keyframes.filter((key) => key.frame !== frame),
    },
  };
}

export function setCameraKeyframeEasing(project: Project, frame: number, easing: EasingKind): Project {
  return {
    ...project,
    camera: {
      ...project.camera,
      keyframes: project.camera.keyframes.map((key) => (key.frame === frame ? { ...key, easing } : key)),
    },
  };
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
      frames.splice(index + 1, 0, { strokes: copy, images: [], exposure: 1 });
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

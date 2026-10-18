import { History } from './history';
import type { EasingKind, Project, Stroke, Transform } from '../model/types';
import * as project from './project';

export class EditorEngine {
  readonly history = new History();
  private state: Project;
  private listeners = new Set<() => void>();
  private pendingBefore: Project | null = null;

  constructor(initial: Project = project.createProject()) {
    this.state = initial;
    this.history.subscribe(() => this.notify());
  }

  getProject(): Project {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }

  private commit(label: string, next: Project): void {
    if (next === this.state) return;
    const previous = this.state;
    this.history.execute({
      label,
      do: () => {
        this.state = next;
      },
      undo: () => {
        this.state = previous;
      },
    });
  }

  drawStroke(layerId: string, frameIndex: number, stroke: Stroke): void {
    this.commit('draw', project.addStroke(this.state, layerId, frameIndex, stroke));
  }

  setFps(fps: number): void {
    this.commit('fps', project.setFps(this.state, fps));
  }

  addLayer(): void {
    this.commit('add-layer', project.addLayer(this.state));
  }

  removeLayer(layerId: string): void {
    this.commit('remove-layer', project.removeLayer(this.state, layerId));
  }

  moveLayer(layerId: string, direction: -1 | 1): void {
    this.commit('move-layer', project.moveLayer(this.state, layerId, direction));
  }

  toggleLayerVisibility(layerId: string): void {
    this.commit(
      'toggle-visibility',
      project.updateLayer(this.state, layerId, (layer) => ({ ...layer, visible: !layer.visible })),
    );
  }

  setLayerOpacity(layerId: string, opacity: number): void {
    this.commit(
      'opacity',
      project.updateLayer(this.state, layerId, (layer) => ({
        ...layer,
        opacity: Math.min(1, Math.max(0, opacity)),
      })),
    );
  }

  renameLayer(layerId: string, name: string): void {
    this.commit(
      'rename',
      project.updateLayer(this.state, layerId, (layer) => ({ ...layer, name })),
    );
  }

  setParent(layerId: string, parentId: string | null): void {
    this.commit('parent', project.setParent(this.state, layerId, parentId));
  }

  setTransformValue(layerId: string, frame: number, transform: Transform): void {
    this.commit('transform', project.setTransformAtFrame(this.state, layerId, frame, transform));
  }

  beginTransform(): void {
    this.pendingBefore = this.state;
  }

  updateLiveTransform(layerId: string, frame: number, transform: Transform): void {
    this.state = project.setTransformAtFrame(this.state, layerId, frame, transform);
    this.notify();
  }

  endTransform(): void {
    const before = this.pendingBefore;
    this.pendingBefore = null;
    if (!before || before === this.state) return;
    const after = this.state;
    this.history.execute({
      label: 'transform-drag',
      do: () => {
        this.state = after;
      },
      undo: () => {
        this.state = before;
      },
    });
  }

  addKeyframe(layerId: string, frame: number): void {
    this.commit('add-keyframe', project.addKeyframeAt(this.state, layerId, frame));
  }

  removeKeyframe(layerId: string, frame: number): void {
    this.commit('remove-keyframe', project.removeKeyframeAt(this.state, layerId, frame));
  }

  setKeyframeEasing(layerId: string, frame: number, easing: EasingKind): void {
    this.commit('easing', project.setKeyframeEasing(this.state, layerId, frame, easing));
  }

  appendFrame(): void {
    this.commit('append-frame', project.appendFrame(this.state));
  }

  duplicateFrame(layerId: string, frameIndex: number): void {
    this.commit('duplicate-frame', project.insertFrameAfter(this.state, frameIndex, layerId));
  }

  removeFrame(frameIndex: number): void {
    this.commit('remove-frame', project.removeFrame(this.state, frameIndex));
  }

  undo(): void {
    this.history.undo();
  }

  redo(): void {
    this.history.redo();
  }
}

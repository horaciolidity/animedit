import { History } from './history';
import type { Project, Stroke } from '../model/types';
import * as project from './project';

export class EditorEngine {
  readonly history = new History();
  private state: Project;

  constructor(initial: Project = project.createProject()) {
    this.state = initial;
  }

  getProject(): Project {
    return this.state;
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

  subscribe(listener: () => void): () => void {
    return this.history.subscribe(listener);
  }
}

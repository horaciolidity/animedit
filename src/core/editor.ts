import { History } from './history';
import type { Stroke } from '../model/types';

export class EditorEngine {
  readonly history = new History();
  private strokes: Stroke[] = [];

  getStrokes(): readonly Stroke[] {
    return this.strokes;
  }

  addStroke(stroke: Stroke): void {
    this.history.execute({
      label: 'add-stroke',
      do: () => {
        this.strokes = [...this.strokes, stroke];
      },
      undo: () => {
        this.strokes = this.strokes.filter((s) => s.id !== stroke.id);
      },
    });
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

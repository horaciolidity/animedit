export interface Command {
  label: string;
  do(): void;
  undo(): void;
}

export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private listeners = new Set<() => void>();

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  execute(command: Command): void {
    command.do();
    this.undoStack.push(command);
    this.redoStack.length = 0;
    this.emit();
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;
    command.undo();
    this.redoStack.push(command);
    this.emit();
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;
    command.do();
    this.undoStack.push(command);
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emit();
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

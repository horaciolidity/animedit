import { create } from 'zustand';
import type { ToolKind } from '../model/types';

interface ToolState {
  tool: ToolKind;
  color: string;
  size: number;
  setTool: (tool: ToolKind) => void;
  setColor: (color: string) => void;
  setSize: (size: number) => void;
}

export const useToolStore = create<ToolState>((set) => ({
  tool: 'brush',
  color: '#1e1e1e',
  size: 6,
  setTool: (tool) => set({ tool }),
  setColor: (color) => set({ color }),
  setSize: (size) => set({ size }),
}));

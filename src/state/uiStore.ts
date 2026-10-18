import { create } from 'zustand';

interface UiState {
  activeLayerId: string | null;
  currentFrame: number;
  setActiveLayer: (id: string) => void;
  setCurrentFrame: (frame: number) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeLayerId: null,
  currentFrame: 0,
  setActiveLayer: (activeLayerId) => set({ activeLayerId }),
  setCurrentFrame: (currentFrame) => set({ currentFrame: Math.max(0, Math.floor(currentFrame)) }),
}));

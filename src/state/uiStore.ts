import { create } from 'zustand';

interface UiState {
  activeLayerId: string | null;
  currentFrame: number;
  isPlaying: boolean;
  onionEnabled: boolean;
  onionBefore: number;
  onionAfter: number;
  setActiveLayer: (id: string) => void;
  setCurrentFrame: (frame: number) => void;
  setPlaying: (playing: boolean) => void;
  setOnionEnabled: (enabled: boolean) => void;
  setOnionBefore: (count: number) => void;
  setOnionAfter: (count: number) => void;
}

function clampCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(4, Math.max(0, Math.floor(count)));
}

export const useUiStore = create<UiState>((set) => ({
  activeLayerId: null,
  currentFrame: 0,
  isPlaying: false,
  onionEnabled: false,
  onionBefore: 1,
  onionAfter: 1,
  setActiveLayer: (activeLayerId) => set({ activeLayerId }),
  setCurrentFrame: (currentFrame) => set({ currentFrame: Math.max(0, Math.floor(currentFrame)) }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setOnionEnabled: (onionEnabled) => set({ onionEnabled }),
  setOnionBefore: (count) => set({ onionBefore: clampCount(count) }),
  setOnionAfter: (count) => set({ onionAfter: clampCount(count) }),
}));

import { create } from 'zustand';

interface UiState {
  activeLayerId: string | null;
  currentFrame: number;
  isPlaying: boolean;
  onionEnabled: boolean;
  onionBefore: number;
  onionAfter: number;
  zoom: number;
  panX: number;
  panY: number;
  playbackStart: number;
  playbackEnd: number;
  setActiveLayer: (id: string) => void;
  setCurrentFrame: (frame: number) => void;
  setPlaying: (playing: boolean) => void;
  setOnionEnabled: (enabled: boolean) => void;
  setOnionBefore: (count: number) => void;
  setOnionAfter: (count: number) => void;
  setPan: (x: number, y: number) => void;
  zoomAt: (factor: number, cx: number, cy: number, width: number, height: number) => void;
  resetView: () => void;
  setPlaybackStart: (v: number) => void;
  setPlaybackEnd: (v: number) => void;
}

function clampCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(4, Math.max(0, Math.floor(count)));
}

function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(6, Math.max(0.2, zoom));
}

export const useUiStore = create<UiState>((set) => ({
  activeLayerId: null,
  currentFrame: 0,
  isPlaying: false,
  onionEnabled: false,
  onionBefore: 1,
  onionAfter: 1,
  zoom: 1,
  panX: 0,
  panY: 0,
  playbackStart: 0,
  playbackEnd: 0,
  setActiveLayer: (activeLayerId) => set({ activeLayerId }),
  setCurrentFrame: (currentFrame) => set({ currentFrame: Math.max(0, Math.floor(currentFrame)) }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setOnionEnabled: (onionEnabled) => set({ onionEnabled }),
  setOnionBefore: (count) => set({ onionBefore: clampCount(count) }),
  setOnionAfter: (count) => set({ onionAfter: clampCount(count) }),
  setPan: (panX, panY) => set({ panX, panY }),
  zoomAt: (factor, cx, cy, width, height) =>
    set((state) => {
      const zoom = clampZoom(state.zoom * factor);
      const ratio = zoom / state.zoom;
      const dx = cx - width / 2;
      const dy = cy - height / 2;
      return {
        zoom,
        panX: dx - (dx - state.panX) * ratio,
        panY: dy - (dy - state.panY) * ratio,
      };
    }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
  setPlaybackStart: (v) => set({ playbackStart: Math.max(0, Math.floor(v)) }),
  setPlaybackEnd: (v) => set({ playbackEnd: Math.max(0, Math.floor(v)) }),
}));

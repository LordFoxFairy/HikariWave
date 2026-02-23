import { create } from "zustand";
import type { Generation } from "../types";

interface PlayerState {
  currentTrack: Generation | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  likedIds: Set<number>;
  setCurrentTrack: (track: Generation | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  play: (track: Generation) => void;
  stop: () => void;
  toggleLike: (id: number) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTrack: null,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  likedIds: new Set<number>(),
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  play: (track) =>
    set({ currentTrack: track, isPlaying: true }),
  stop: () =>
    set({ isPlaying: false, currentTime: 0 }),
  toggleLike: (id) =>
    set((s) => {
      const next = new Set(s.likedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { likedIds: next };
    }),
}));

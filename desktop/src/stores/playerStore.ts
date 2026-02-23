import { create } from "zustand";
import type { Generation } from "../types";

interface PlayerState {
  currentTrack: Generation | null;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  setCurrentTrack: (track: Generation | null) => void;
  setIsPlaying: (playing: boolean) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  play: (track: Generation) => void;
  stop: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  currentTrack: null,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setVolume: (volume) => set({ volume }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  play: (track) =>
    set({ currentTrack: track, isPlaying: true }),
  stop: () =>
    set({ isPlaying: false, currentTime: 0 }),
}));

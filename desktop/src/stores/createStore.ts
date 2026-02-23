import { create } from "zustand";
import type { GenerationStatus } from "../types";

const GENRE_OPTIONS = [
  "Pop", "Rock", "Hip Hop", "R&B", "Jazz",
  "Electronic", "Classical", "Country", "Folk",
  "Metal", "Indie", "Blues", "Reggae", "Latin",
];

const MOOD_OPTIONS = [
  "Happy", "Sad", "Energetic", "Calm",
  "Romantic", "Dark", "Uplifting", "Melancholic",
  "Aggressive", "Dreamy", "Nostalgic", "Epic",
];

interface CreateState {
  prompt: string;
  lyrics: string;
  selectedGenres: string[];
  selectedMoods: string[];
  duration: number;
  generationStatus: GenerationStatus | "idle";
  currentTaskId: string | null;
  progress: number;
  genreOptions: string[];
  moodOptions: string[];
  setPrompt: (prompt: string) => void;
  setLyrics: (lyrics: string) => void;
  toggleGenre: (genre: string) => void;
  toggleMood: (mood: string) => void;
  setDuration: (duration: number) => void;
  setGenerationStatus: (status: GenerationStatus | "idle") => void;
  setCurrentTaskId: (id: string | null) => void;
  setProgress: (progress: number) => void;
  reset: () => void;
}

export const useCreateStore = create<CreateState>((set) => ({
  prompt: "",
  lyrics: "",
  selectedGenres: [],
  selectedMoods: [],
  duration: 30,
  generationStatus: "idle",
  currentTaskId: null,
  progress: 0,
  genreOptions: GENRE_OPTIONS,
  moodOptions: MOOD_OPTIONS,
  setPrompt: (prompt) => set({ prompt }),
  setLyrics: (lyrics) => set({ lyrics }),
  toggleGenre: (genre) =>
    set((s) => ({
      selectedGenres: s.selectedGenres.includes(genre)
        ? s.selectedGenres.filter((g) => g !== genre)
        : [...s.selectedGenres, genre],
    })),
  toggleMood: (mood) =>
    set((s) => ({
      selectedMoods: s.selectedMoods.includes(mood)
        ? s.selectedMoods.filter((m) => m !== mood)
        : [...s.selectedMoods, mood],
    })),
  setDuration: (duration) => set({ duration }),
  setGenerationStatus: (status: GenerationStatus | "idle") =>
    set({ generationStatus: status }),
  setCurrentTaskId: (id: string | null) =>
    set({ currentTaskId: id }),
  setProgress: (progress: number) =>
    set({ progress }),
  reset: () =>
    set({
      prompt: "",
      lyrics: "",
      selectedGenres: [],
      selectedMoods: [],
      duration: 30,
      generationStatus: "idle",
      currentTaskId: null,
      progress: 0,
    }),
}));

import {create} from "zustand";
import type {CreateMode, GenerationStatus, TaskType} from "../types";

export const GENRE_OPTIONS = [
    "Pop", "Rock", "Jazz", "Electronic", "Hip-Hop", "R&B",
    "Classical", "Country", "Folk", "Lo-fi", "Ambient", "Latin",
    "K-Pop", "J-Pop", "Metal", "Blues", "Reggae", "Soul",
    "Funk", "Indie",
];

export const MOOD_OPTIONS = [
    "Happy", "Sad", "Energetic", "Calm", "Romantic", "Dark",
    "Nostalgic", "Dreamy", "Epic", "Chill", "Melancholy", "Uplifting",
];

export const INSTRUMENT_OPTIONS = [
    "Piano", "Guitar", "Bass", "Drums", "Strings", "Synth",
    "Brass", "Woodwind", "Choir", "Vocal", "Percussion",
];

export const KEY_OPTIONS = [
    "C Major", "C Minor", "C# Major", "C# Minor",
    "D Major", "D Minor", "Eb Major", "Eb Minor",
    "E Major", "E Minor", "F Major", "F Minor",
    "F# Major", "F# Minor", "G Major", "G Minor",
    "Ab Major", "Ab Minor", "A Major", "A Minor",
    "Bb Major", "Bb Minor", "B Major", "B Minor",
];

export const LANGUAGE_OPTIONS = [
    "Chinese", "English", "Japanese", "Korean",
    "Spanish", "French", "German", "Portuguese",
];

interface CreateState {
    mode: CreateMode;
    prompt: string;
    title: string;
    lyrics: string;
    selectedGenres: string[];
    selectedMoods: string[];
    duration: number;
    tempo: number;
    musicalKey: string;
    instruments: string[];
    language: string;
    instrumental: boolean;
    lyricsAiGenerated: boolean;
    generationStatus: GenerationStatus | "idle";
    currentTaskId: string | null;
    progress: number;
    aiSuggesting: Record<string, boolean>;
    errorMessage: string | null;
    successMessage: string | null;

    // Style transfer / Cover / Repaint
    taskType: TaskType;
    referenceAudioFile: File | null;
    srcAudioFile: File | null;
    audioCoverStrength: number;
    coverNoiseStrength: number;
    repaintingStart: number;
    repaintingEnd: number;
    styleReferenceText: string;

    setMode: (mode: CreateMode) => void;
    setPrompt: (prompt: string) => void;
    setTitle: (title: string) => void;
    setLyrics: (lyrics: string) => void;
    toggleGenre: (genre: string) => void;
    toggleMood: (mood: string) => void;
    setDuration: (duration: number) => void;
    setTempo: (tempo: number) => void;
    setMusicalKey: (key: string) => void;
    toggleInstrument: (instrument: string) => void;
    setLanguage: (language: string) => void;
    setInstrumental: (instrumental: boolean) => void;
    setLyricsAiGenerated: (v: boolean) => void;
    setGenerationStatus: (status: GenerationStatus | "idle") => void;
    setCurrentTaskId: (id: string | null) => void;
    setProgress: (progress: number) => void;
    setAiSuggesting: (field: string, loading: boolean) => void;
    setErrorMessage: (msg: string | null) => void;
    setSuccessMessage: (msg: string | null) => void;
    applyAiSuggestions: (data: {
        genres?: string[];
        moods?: string[];
        tempo?: number;
        musicalKey?: string;
        instruments?: string[];
        title?: string;
    }) => void;

    // Style transfer setters
    setTaskType: (t: TaskType) => void;
    setReferenceAudioFile: (f: File | null) => void;
    setSrcAudioFile: (f: File | null) => void;
    setAudioCoverStrength: (v: number) => void;
    setCoverNoiseStrength: (v: number) => void;
    setRepaintingStart: (v: number) => void;
    setRepaintingEnd: (v: number) => void;
    setStyleReferenceText: (v: string) => void;

    reset: () => void;
}

const initialState = {
    mode: "smart" as CreateMode,
    prompt: "",
    title: "",
    lyrics: "",
    selectedGenres: [] as string[],
    selectedMoods: [] as string[],
    duration: 240,
    tempo: 0,
    musicalKey: "",
    instruments: [] as string[],
    language: "Chinese",
    instrumental: false,
    lyricsAiGenerated: false,
    generationStatus: "idle" as GenerationStatus | "idle",
    currentTaskId: null as string | null,
    progress: 0,
    aiSuggesting: {} as Record<string, boolean>,
    errorMessage: null as string | null,
    successMessage: null as string | null,

    // Style transfer / Cover / Repaint
    taskType: "text2music" as TaskType,
    referenceAudioFile: null as File | null,
    srcAudioFile: null as File | null,
    audioCoverStrength: 1.0,
    coverNoiseStrength: 0.0,
    repaintingStart: 0,
    repaintingEnd: 0,
    styleReferenceText: "",
};

export const useCreateStore = create<CreateState>((set) => ({
    ...initialState,

    setMode: (mode) => set({mode}),
    setPrompt: (prompt) => set({prompt}),
    setTitle: (title) => set({title}),
    setLyrics: (lyrics) => set({lyrics}),
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
    setDuration: (duration) => set({duration}),
    setTempo: (tempo) => set({tempo}),
    setMusicalKey: (musicalKey) => set({musicalKey}),
    toggleInstrument: (instrument) =>
        set((s) => ({
            instruments: s.instruments.includes(instrument)
                ? s.instruments.filter((i) => i !== instrument)
                : [...s.instruments, instrument],
        })),
    setLanguage: (language) => set({language}),
    setInstrumental: (instrumental) => set({instrumental}),
    setLyricsAiGenerated: (v) => set({lyricsAiGenerated: v}),
    setGenerationStatus: (status) => set({generationStatus: status}),
    setCurrentTaskId: (id) => set({currentTaskId: id}),
    setProgress: (progress) => set({progress}),
    setAiSuggesting: (field, loading) =>
        set((s) => ({
            aiSuggesting: {...s.aiSuggesting, [field]: loading},
        })),
    setErrorMessage: (msg) => set({errorMessage: msg}),
    setSuccessMessage: (msg) => set({successMessage: msg}),
    applyAiSuggestions: (data) =>
        set((s) => ({
            selectedGenres: data.genres ?? s.selectedGenres,
            selectedMoods: data.moods ?? s.selectedMoods,
            tempo: data.tempo ?? s.tempo,
            musicalKey: data.musicalKey ?? s.musicalKey,
            instruments: data.instruments ?? s.instruments,
            title: data.title ?? s.title,
        })),

    // Style transfer setters
    setTaskType: (t) => set({taskType: t}),
    setReferenceAudioFile: (f) => set({referenceAudioFile: f}),
    setSrcAudioFile: (f) => set({srcAudioFile: f}),
    setAudioCoverStrength: (v) => set({audioCoverStrength: v}),
    setCoverNoiseStrength: (v) => set({coverNoiseStrength: v}),
    setRepaintingStart: (v) => set({repaintingStart: v}),
    setRepaintingEnd: (v) => set({repaintingEnd: v}),
    setStyleReferenceText: (v) => set({styleReferenceText: v}),

    reset: () => set(initialState),
}));

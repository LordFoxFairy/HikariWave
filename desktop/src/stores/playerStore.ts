import {create} from "zustand";
import type {Generation} from "../types";
import {useLibraryStore} from "./libraryStore";

interface PlayerState {
    currentTrack: Generation | null;
    isPlaying: boolean;
    volume: number;
    currentTime: number;
    duration: number;
    queue: Generation[];
    queueIndex: number;
    setCurrentTrack: (track: Generation | null) => void;
    setIsPlaying: (playing: boolean) => void;
    setVolume: (volume: number) => void;
    setCurrentTime: (time: number) => void;
    setDuration: (duration: number) => void;
    play: (track: Generation) => void;
    stop: () => void;
    toggleLike: (id: number) => void;
    setQueue: (tracks: Generation[], startIndex: number) => void;
    playNext: () => void;
    playPrevious: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
    currentTrack: null,
    isPlaying: false,
    volume: (() => {
        const saved = localStorage.getItem("hikari-volume");
        if (saved !== null) {
            const v = parseFloat(saved);
            if (!isNaN(v) && v >= 0 && v <= 1) return v;
        }
        return 0.8;
    })(),
    currentTime: 0,
    duration: 0,
    queue: [],
    queueIndex: -1,
    setCurrentTrack: (track) => set({currentTrack: track}),
    setIsPlaying: (playing) => set({isPlaying: playing}),
    setVolume: (volume) => {
        localStorage.setItem("hikari-volume", String(volume));
        set({volume});
    },
    setCurrentTime: (time) => set({currentTime: time}),
    setDuration: (duration) => set({duration}),
    play: (track) => {
        const {queue} = get();
        const idx = queue.findIndex((t) => t.id === track.id);
        set({
            currentTrack: track,
            isPlaying: true,
            ...(idx !== -1 ? {queueIndex: idx} : {}),
        });
    },
    stop: () =>
        set({isPlaying: false, currentTime: 0}),
    toggleLike: (id) => {
        const track = get().currentTrack;
        if (track && track.id === id) {
            const newLiked = !track.is_liked;
            set({currentTrack: {...track, is_liked: newLiked}});
        }
        // Sync with libraryStore
        useLibraryStore.getState().toggleLike(id);
    },
    setQueue: (tracks, startIndex) => {
        const track = tracks[startIndex];
        if (!track) return;
        set({
            queue: tracks,
            queueIndex: startIndex,
            currentTrack: track,
            isPlaying: true,
        });
    },
    playNext: () => {
        const {queue, queueIndex} = get();
        if (queue.length === 0) {
            set({isPlaying: false});
            return;
        }
        const nextIndex = queueIndex + 1;
        if (nextIndex >= queue.length) {
            // End of queue — stop
            set({isPlaying: false});
            return;
        }
        set({
            queueIndex: nextIndex,
            currentTrack: queue[nextIndex],
            isPlaying: true,
        });
    },
    playPrevious: () => {
        const {queue, queueIndex} = get();
        if (queue.length === 0) return;
        const prevIndex = queueIndex - 1;
        if (prevIndex < 0) return;
        set({
            queueIndex: prevIndex,
            currentTrack: queue[prevIndex],
            isPlaying: true,
        });
    },
}));

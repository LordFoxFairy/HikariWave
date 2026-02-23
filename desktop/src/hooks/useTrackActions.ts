import {useCallback} from "react";
import {useCreateStore} from "../stores/createStore";
import {useAppStore} from "../stores/appStore";
import {api} from "../services/api";
import type {Generation} from "../types";

export function useTrackActions() {
    const createStore = useCreateStore();
    const setCurrentPage = useAppStore((s) => s.setCurrentPage);

    const handleExtend = useCallback(
        (gen: Generation) => {
            createStore.reset();
            createStore.setPrompt(gen.prompt || "");
            createStore.setTitle(gen.title ? `${gen.title} (Extended)` : "");
            createStore.setLyrics(gen.lyrics || "");
            if (gen.genre) {
                for (const g of gen.genre.split(",").map((s) => s.trim()))
                    createStore.toggleGenre(g);
            }
            if (gen.mood) {
                for (const m of gen.mood.split(",").map((s) => s.trim()))
                    createStore.toggleMood(m);
            }
            if (gen.tempo) createStore.setTempo(gen.tempo);
            if (gen.musical_key) createStore.setMusicalKey(gen.musical_key);
            setCurrentPage("create");
        },
        [createStore, setCurrentPage],
    );

    const handleRemix = useCallback(
        (gen: Generation) => {
            createStore.reset();
            createStore.setPrompt(gen.prompt ? `Remix: ${gen.prompt}` : "");
            createStore.setTitle(gen.title ? `${gen.title} (Remix)` : "");
            if (gen.genre) {
                for (const g of gen.genre.split(",").map((s) => s.trim()))
                    createStore.toggleGenre(g);
            }
            if (gen.mood) {
                for (const m of gen.mood.split(",").map((s) => s.trim()))
                    createStore.toggleMood(m);
            }
            if (gen.tempo) createStore.setTempo(gen.tempo);
            if (gen.musical_key) createStore.setMusicalKey(gen.musical_key);
            createStore.setMode("custom");
            setCurrentPage("create");
        },
        [createStore, setCurrentPage],
    );

    const handleRegenerateCover = useCallback(
        async (
            gen: Generation,
            updateFn: (id: number, data: Partial<Generation>) => void,
        ) => {
            try {
                const res = await api.regenerateCover({
                    generation_id: gen.id,
                    title: gen.title || undefined,
                    genre: gen.genre || undefined,
                    mood: gen.mood || undefined,
                    lyrics: gen.lyrics || undefined,
                });
                updateFn(gen.id, {
                    cover_art_path: res.cover_art_path,
                });
            } catch {
                /* noop */
            }
        },
        [],
    );

    return {handleExtend, handleRemix, handleRegenerateCover};
}

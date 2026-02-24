import {create} from "zustand";
import type {Generation} from "../types";
import {api} from "../services/api";

type ViewMode = "grid" | "list";
type SortField = "created_at" | "title" | "actual_duration";
type SortDir = "asc" | "desc";

interface LibraryFilters {
    search: string;
    isLiked: boolean;
    genre: string;
    mood: string;
    status: string; // "" = all, "completed", "processing", "failed"
}

interface LibraryState {
    generations: Generation[];
    total: number;
    loading: boolean;
    error: string | null;
    filters: LibraryFilters;
    sortField: SortField;
    sortDir: SortDir;
    viewMode: ViewMode;
    offset: number;
    limit: number;

    fetchGenerations: (append?: boolean) => Promise<void>;
    setFilter: <K extends keyof LibraryFilters>(
        key: K,
        value: LibraryFilters[K],
    ) => void;
    clearFilters: () => void;
    setSort: (field: SortField, dir: SortDir) => void;
    setViewMode: (mode: ViewMode) => void;
    toggleLike: (id: number) => void;
    deleteGeneration: (id: number) => Promise<void>;
    updateGeneration: (id: number, patch: Partial<Generation>) => void;
    loadMore: () => Promise<void>;
}

const DEFAULT_FILTERS: LibraryFilters = {
    search: "",
    isLiked: false,
    genre: "",
    mood: "",
    status: "",
};

export const useLibraryStore = create<LibraryState>((set, get) => ({
    generations: [],
    total: 0,
    loading: false,
    error: null,
    filters: {...DEFAULT_FILTERS},
    sortField: "created_at",
    sortDir: "desc",
    viewMode: "grid",
    offset: 0,
    limit: 30,

    fetchGenerations: async (append = false) => {
        const state = get();
        if (!append) set({loading: true, error: null, offset: 0});

        const offset = append ? state.offset : 0;
        try {
            const data = await api.getGenerations({
                offset,
                limit: state.limit,
                search: state.filters.search || undefined,
                is_liked: state.filters.isLiked ? true : undefined,
                genre: state.filters.genre || undefined,
                mood: state.filters.mood || undefined,
                status: state.filters.status || undefined,
                sort: state.sortField,
                sort_dir: state.sortDir,
            });
            set({
                generations: append
                    ? [...state.generations, ...data.items]
                    : data.items,
                total: data.total,
                offset: offset + data.items.length,
            });
        } catch {
            set({error: "library.loadError"});
        } finally {
            set({loading: false});
        }
    },

    setFilter: (key, value) => {
        set((s) => ({filters: {...s.filters, [key]: value}}));
        // Auto-fetch on filter change
        setTimeout(() => get().fetchGenerations(), 0);
    },

    clearFilters: () => {
        set({filters: {...DEFAULT_FILTERS}});
        setTimeout(() => get().fetchGenerations(), 0);
    },

    setSort: (field, dir) => {
        set({sortField: field, sortDir: dir});
        setTimeout(() => get().fetchGenerations(), 0);
    },

    setViewMode: (mode) => set({viewMode: mode}),

    toggleLike: (id) => {
        // Optimistic update in library
        set((s) => ({
            generations: s.generations.map((g) =>
                g.id === id ? {...g, is_liked: !g.is_liked} : g,
            ),
        }));
        // Sync player's currentTrack if it matches (lazy import to avoid circular)
        import("./playerStore").then(({usePlayerStore}) => {
            const ps = usePlayerStore.getState();
            if (ps.currentTrack?.id === id) {
                ps.setCurrentTrack({
                    ...ps.currentTrack,
                    is_liked: !ps.currentTrack.is_liked,
                });
            }
        });
        api.toggleLike(id).catch(() => {
            // Revert on failure
            set((s) => ({
                generations: s.generations.map((g) =>
                    g.id === id ? {...g, is_liked: !g.is_liked} : g,
                ),
            }));
        });
    },

    deleteGeneration: async (id) => {
        try {
            await api.deleteGeneration(id);
            set((s) => ({
                generations: s.generations.filter((g) => g.id !== id),
                total: s.total - 1,
            }));
        } catch {
            /* noop */
        }
    },

    updateGeneration: (id, patch) => {
        set((s) => ({
            generations: s.generations.map((g) =>
                g.id === id ? {...g, ...patch} : g,
            ),
        }));
    },

    loadMore: async () => {
        await get().fetchGenerations(true);
    },
}));

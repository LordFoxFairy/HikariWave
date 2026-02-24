import {create} from "zustand";
import {api} from "../services/api";
import type {CachedModelInfo, DownloadProgress, HFModelInfo, ProviderTab,} from "../types";

interface ProviderState {
    activeTab: ProviderTab;
    setActiveTab: (tab: ProviderTab) => void;

    // Marketplace search
    searchQuery: string;
    searchResults: HFModelInfo[];
    searchLoading: boolean;
    setSearchQuery: (q: string) => void;
    searchModels: (query: string, pipelineTag: string, sort?: string) => Promise<void>;

    // Downloads
    downloads: DownloadProgress[];
    startDownload: (repoId: string) => Promise<void>;
    refreshDownloads: () => Promise<void>;

    // Cache
    cachedModels: CachedModelInfo[];
    refreshCache: () => Promise<void>;
    deleteCache: (repoId: string) => Promise<void>;
}

export const useProviderStore = create<ProviderState>((set) => ({
    activeTab: "llm",
    setActiveTab: (tab) => set({activeTab: tab}),

    searchQuery: "",
    searchResults: [],
    searchLoading: false,
    setSearchQuery: (q) => set({searchQuery: q}),

    searchModels: async (query, pipelineTag, sort) => {
        set({searchLoading: true});
        try {
            const res = await api.searchModels(query, pipelineTag, sort);
            set({searchResults: res.models});
        } catch {
            set({searchResults: []});
        } finally {
            set({searchLoading: false});
        }
    },

    downloads: [],
    startDownload: async (repoId) => {
        try {
            const dl = await api.downloadModel(repoId);
            set((s) => ({downloads: [...s.downloads, dl]}));
        } catch {
            /* handled by caller */
        }
    },

    refreshDownloads: async () => {
        try {
            const downloads = await api.getDownloadProgress();
            set({downloads: Array.isArray(downloads) ? downloads : []});
        } catch {
            /* noop */
        }
    },

    cachedModels: [],
    refreshCache: async () => {
        try {
            const cached = await api.getCachedModels();
            set({cachedModels: Array.isArray(cached) ? cached : []});
        } catch {
            /* noop */
        }
    },

    deleteCache: async (repoId) => {
        try {
            await api.deleteCachedModel(repoId);
            // Remove from local state
            set((s) => ({
                cachedModels: s.cachedModels.filter((c) => c.repo_id !== repoId),
            }));
        } catch {
            /* noop */
        }
    },
}));

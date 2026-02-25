import {create} from "zustand";
import type {PageId} from "../types";

interface AppState {
    currentPage: PageId;
    sidebarCollapsed: boolean;
    detailGenerationId: number | null;
    previousPage: PageId;
    setCurrentPage: (page: PageId) => void;
    toggleSidebar: () => void;
    openDetail: (id: number) => void;
    closeDetail: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    currentPage: "create",
    sidebarCollapsed: false,
    detailGenerationId: null,
    previousPage: "library",
    setCurrentPage: (page) => set({currentPage: page}),
    toggleSidebar: () =>
        set((s) => ({sidebarCollapsed: !s.sidebarCollapsed})),
    openDetail: (id) =>
        set((s) => ({
            detailGenerationId: id,
            previousPage: s.currentPage === "detail" ? s.previousPage : s.currentPage,
            currentPage: "detail",
        })),
    closeDetail: () => {
        const {previousPage} = get();
        set({
            currentPage: previousPage,
            detailGenerationId: null,
        });
    },
}));

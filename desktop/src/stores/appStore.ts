import { create } from "zustand";
import type { PageId } from "../types";

interface AppState {
  currentPage: PageId;
  sidebarCollapsed: boolean;
  setCurrentPage: (page: PageId) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: "create",
  sidebarCollapsed: false,
  setCurrentPage: (page) => set({ currentPage: page }),
  toggleSidebar: () =>
    set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));

import { create } from "zustand";
import { setBaseUrl } from "../services/api";

interface SettingsState {
  backendUrl: string;
  setBackendUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  backendUrl: "http://127.0.0.1:23456/api/v1",
  setBackendUrl: (url) => {
    setBaseUrl(url);
    set({ backendUrl: url });
  },
}));

import { create } from "zustand";
import { setBaseUrl } from "../services/api";

interface SettingsState {
  backendUrl: string;
  llmProvider: string;
  musicProvider: string;
  setBackendUrl: (url: string) => void;
  setLlmProvider: (provider: string) => void;
  setMusicProvider: (provider: string) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  backendUrl: "http://127.0.0.1:23456/api/v1",
  llmProvider: "openrouter",
  musicProvider: "local:ace-step-v1",
  setBackendUrl: (url) => {
    setBaseUrl(url);
    set({ backendUrl: url });
  },
  setLlmProvider: (provider) => set({ llmProvider: provider }),
  setMusicProvider: (provider) =>
    set({ musicProvider: provider }),
}));

import {create} from "zustand";
import {persist} from "zustand/middleware";
import {setBaseUrl} from "../services/api";
import i18n from "../i18n";

interface SettingsState {
    backendUrl: string;
    locale: string;
    setBackendUrl: (url: string) => void;
    setLocale: (locale: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            backendUrl: "http://127.0.0.1:23456/api/v1",
            locale: "",
            setBackendUrl: (url) => {
                setBaseUrl(url);
                set({backendUrl: url});
            },
            setLocale: (locale) => {
                i18n.changeLanguage(locale);
                set({locale});
            },
        }),
        {
            name: "hikariwave-settings",
            onRehydrateStorage: () => (state) => {
                // Sync the API module's baseUrl when persisted settings are hydrated
                if (state?.backendUrl) {
                    setBaseUrl(state.backendUrl);
                }
                // Sync locale when persisted settings are hydrated
                if (state?.locale) {
                    i18n.changeLanguage(state.locale);
                }
            },
        },
    ),
);

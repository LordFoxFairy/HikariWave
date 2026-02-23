import i18n from "i18next";
import {initReactI18next} from "react-i18next";
import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";

// Detect default language: check persisted setting first, then navigator
function getDefaultLanguage(): string {
    try {
        const stored = localStorage.getItem("hikariwave-settings");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.state?.locale) {
                return parsed.state.locale;
            }
        }
    } catch {
        // ignore
    }
    // Fall back to browser language
    const lang = navigator.language || "";
    if (lang.startsWith("zh")) return "zh-CN";
    return "en";
}

i18n.use(initReactI18next).init({
    resources: {
        "zh-CN": {translation: zhCN},
        en: {translation: en},
    },
    lng: getDefaultLanguage(),
    fallbackLng: "en",
    interpolation: {
        escapeValue: false,
    },
});

export default i18n;

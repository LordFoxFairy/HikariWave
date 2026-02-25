import {useEffect, useState} from "react";
import {AlertTriangle, WifiOff, X} from "lucide-react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import Sidebar from "./components/Sidebar";
import Player from "./components/Player";
import CreatePage from "./pages/CreatePage";
import LibraryPage from "./pages/LibraryPage";
import ProvidersPage from "./pages/ProvidersPage";
import SettingsPage from "./pages/SettingsPage";
import SongDetailPage from "./pages/SongDetailPage";
import {useAppStore} from "./stores/appStore";
import {usePlayerStore} from "./stores/playerStore";
import {api} from "./services/api";

const DISMISS_KEY = "hikariwave-setup-dismissed";

type BannerKind = "offline" | "no-providers" | null;

function SetupBanner() {
    const [banner, setBanner] = useState<BannerKind>(null);
    const [dismissed, setDismissed] = useState(() => {
        try {
            return localStorage.getItem(DISMISS_KEY) === "1";
        } catch {
            return false;
        }
    });
    const setCurrentPage = useAppStore((s) => s.setCurrentPage);
    const {t} = useTranslation();

    useEffect(() => {
        if (dismissed) return;
        let cancelled = false;

        (async () => {
            try {
                await api.healthCheck();
                if (cancelled) return;
                // Backend is reachable -- check LLM config
                try {
                    const config = await api.getLLMConfig();
                    if (cancelled) return;
                    const hasProvider =
                        config.providers &&
                        config.providers.length > 0 &&
                        config.providers.some((p) => p.api_key || p.base_url);
                    if (!hasProvider) {
                        setBanner("no-providers");
                    }
                } catch {
                    // Config endpoint failed but backend is up -- ignore
                }
            } catch {
                if (!cancelled) {
                    setBanner("offline");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [dismissed]);

    const handleDismiss = () => {
        setDismissed(true);
        setBanner(null);
        try {
            localStorage.setItem(DISMISS_KEY, "1");
        } catch {
            // localStorage unavailable
        }
    };

    if (dismissed || !banner) return null;

    const isOffline = banner === "offline";

    return (
        <AnimatePresence>
            <motion.div
                initial={{height: 0, opacity: 0}}
                animate={{height: "auto", opacity: 1}}
                exit={{height: 0, opacity: 0}}
                transition={{duration: 0.2}}
                className={`flex-shrink-0 ${
                    isOffline
                        ? "bg-red-50 border-b border-red-200"
                        : "bg-amber-50 border-b border-amber-200"
                }`}
            >
                <div className="flex items-center gap-2.5 px-4 py-2">
                    {isOffline ? (
                        <WifiOff className="w-3.5 h-3.5 text-red-500 flex-shrink-0"/>
                    ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"/>
                    )}
                    <span
                        className={`text-[12px] leading-snug flex-1 ${
                            isOffline ? "text-red-700" : "text-amber-700"
                        }`}
                    >
            {isOffline ? (
                <>
                    {t("banner.backendNotConnected")}{" "}
                    <button
                        onClick={() => setCurrentPage("settings")}
                        className="underline font-medium hover:no-underline cursor-pointer"
                    >
                        {t("banner.checkSettings")}
                    </button>
                </>
            ) : (
                <>
                    {t("banner.setupProviders")}{" "}
                    <button
                        onClick={() => setCurrentPage("providers")}
                        className="underline font-medium hover:no-underline cursor-pointer"
                    >
                        {t("banner.goToProviders")}
                    </button>
                </>
            )}
          </span>
                    <button
                        onClick={handleDismiss}
                        className={`p-1 rounded-md transition-colors cursor-pointer flex-shrink-0 ${
                            isOffline
                                ? "hover:bg-red-100 text-red-400"
                                : "hover:bg-amber-100 text-amber-400"
                        }`}
                    >
                        <X className="w-3.5 h-3.5"/>
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

function PageRouter() {
    const currentPage = useAppStore((s) => s.currentPage);

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            <SetupBanner/>
            {currentPage === "create" && <CreatePage/>}
            {currentPage === "library" && <LibraryPage/>}
            {currentPage === "providers" && <ProvidersPage/>}
            {currentPage === "settings" && <SettingsPage/>}
            {currentPage === "detail" && <SongDetailPage/>}
        </div>
    );
}

export default function App() {
    // Global keyboard shortcuts
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            const tag = (e.target as HTMLElement).tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") {
                return;
            }

            if (e.key === " ") {
                e.preventDefault();
                const {currentTrack, isPlaying, setIsPlaying} = usePlayerStore.getState();
                if (currentTrack) {
                    setIsPlaying(!isPlaying);
                }
            }

            if (e.key === "Escape") {
                const appState = useAppStore.getState();
                if (appState.currentPage === "detail") {
                    appState.closeDetail();
                    return;
                }
                const {currentTrack, stop} = usePlayerStore.getState();
                if (currentTrack) {
                    stop();
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    return (
        <div className="h-screen flex flex-col bg-surface-secondary">
            {/* Top title bar area (Tauri window drag region) */}
            <div
                data-tauri-drag-region
                className="h-8 flex items-center px-4 bg-white
                   border-b border-border flex-shrink-0
                   select-none"
            >
        <span className="text-[11px] text-text-tertiary
                         font-medium tracking-wide uppercase">
          HikariWave
        </span>
            </div>

            <div className="flex flex-1 overflow-hidden">
                <Sidebar/>
                <main className="flex-1 flex flex-col overflow-hidden">
                    <PageRouter/>
                </main>
            </div>
            <Player/>
        </div>
    );
}

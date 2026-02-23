import {useCallback, useEffect, useMemo, useState} from "react";
import {ArrowUpDown, Music, Search, Sparkles,} from "lucide-react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {usePlayerStore} from "../stores/playerStore";
import {useAppStore} from "../stores/appStore";
import {useLibraryStore} from "../stores/libraryStore";
import {useTrackActions} from "../hooks/useTrackActions";
import ConfirmDialog from "../components/ConfirmDialog";
import HistoryCard from "../components/library/HistoryCard";
import ErrorState from "../components/library/ErrorState";

type SortKey = "date" | "name";

export default function HistoryPage() {
    const {t} = useTranslation();
    const store = useLibraryStore();
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<SortKey>("date");
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const setQueue = usePlayerStore((s) => s.setQueue);
    const setCurrentPage = useAppStore((s) => s.setCurrentPage);
    const {handleExtend, handleRemix, handleRegenerateCover} = useTrackActions();

    useEffect(() => {
        store.fetchGenerations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRegenCover = useCallback(
        (gen: Parameters<typeof handleRegenerateCover>[0]) =>
            handleRegenerateCover(gen, store.updateGeneration),
        [handleRegenerateCover, store.updateGeneration],
    );

    const filtered = useMemo(() => {
        let list = store.generations;
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (g) =>
                    g.prompt.toLowerCase().includes(q) ||
                    g.genre?.toLowerCase().includes(q) ||
                    g.mood?.toLowerCase().includes(q) ||
                    g.title?.toLowerCase().includes(q),
            );
        }
        list = [...list].sort((a, b) => {
            if (sortBy === "name") {
                const nameA = a.title || a.prompt;
                const nameB = b.title || b.prompt;
                return nameA.localeCompare(nameB);
            }
            return (
                new Date(b.created_at).getTime() -
                new Date(a.created_at).getTime()
            );
        });
        return list;
    }, [store.generations, search, sortBy]);

    return (
        <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-end justify-between mb-6">
                    <div>
                        <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-0.5">
                            {t("history.title")}
                        </h1>
                        <p className="text-[13px] text-text-tertiary">
                            {t("history.subtitle")}
                        </p>
                    </div>
                    <span className="text-xs text-text-tertiary tabular-nums">
            {store.generations.length} {store.generations.length !== 1 ? t("library.tracks") : t("library.track")}
          </span>
                </div>

                {/* Search + sort */}
                <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 text-text-tertiary absolute
                               left-3.5 top-1/2 -translate-y-1/2"/>
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t("history.searchPlaceholder")}
                            className="w-full pl-10 pr-3 py-2.5 rounded-xl border
                         border-border bg-white text-sm
                         focus:outline-none focus:ring-2
                         focus:ring-primary-200 focus:border-primary-300
                         placeholder:text-text-tertiary/60"
                        />
                    </div>
                    <button
                        onClick={() =>
                            setSortBy((s) => (s === "date" ? "name" : "date"))
                        }
                        className="flex items-center gap-1.5 px-3.5 py-2.5
                       rounded-xl border border-border bg-white
                       text-[13px] text-text-secondary
                       hover:bg-surface-tertiary transition-colors
                       cursor-pointer"
                    >
                        <ArrowUpDown className="w-3.5 h-3.5"/>
                        {sortBy === "date" ? t("history.sortDate") : t("history.sortName")}
                    </button>
                </div>

                {store.loading && store.generations.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.from({length: 4}).map((_, i) => (
                            <div key={i}
                                 className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-pulse">
                                <div className="h-24 bg-surface-tertiary"/>
                                <div className="p-4 space-y-2.5">
                                    <div className="h-4 bg-surface-tertiary rounded-lg w-3/4"/>
                                    <div className="flex gap-2">
                                        <div className="h-5 bg-surface-tertiary rounded-full w-16"/>
                                        <div className="h-5 bg-surface-tertiary rounded-full w-14"/>
                                    </div>
                                    <div className="h-3 bg-surface-tertiary rounded w-24"/>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : store.error ? (
                    <ErrorState
                        error={store.error}
                        onRetry={() => store.fetchGenerations()}
                    />
                ) : filtered.length === 0 ? (
                    <motion.div
                        initial={{opacity: 0, y: 12}}
                        animate={{opacity: 1, y: 0}}
                        className="text-center py-24"
                    >
                        <div className="w-16 h-16 rounded-2xl bg-primary-50
                            flex items-center justify-center
                            mx-auto mb-4 border border-primary-100">
                            <Music className="w-7 h-7 text-primary-400"/>
                        </div>
                        <p className="text-text-primary font-semibold mb-1">
                            {search ? t("history.noMatchingTracks") : t("history.noTracksYet")}
                        </p>
                        <p className="text-text-tertiary text-[13px] mb-5">
                            {search
                                ? t("history.tryDifferentSearch")
                                : t("history.createFirstSong")}
                        </p>
                        {!search && (
                            <button
                                onClick={() => setCurrentPage("create")}
                                className="inline-flex items-center gap-2 px-5 py-2.5
                           rounded-xl bg-primary-600 text-white
                           text-sm font-medium hover:bg-primary-700
                           transition-colors cursor-pointer shadow-sm"
                            >
                                <Sparkles className="w-4 h-4"/>
                                {t("history.createMusic")}
                            </button>
                        )}
                    </motion.div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <AnimatePresence>
                            {filtered.map((gen, i) => (
                                <HistoryCard
                                    key={gen.id}
                                    gen={gen}
                                    index={i}
                                    onPlay={() => setQueue(filtered, i)}
                                    onDelete={() => setDeleteTargetId(gen.id)}
                                    onExtend={() => handleExtend(gen)}
                                    onRemix={() => handleRemix(gen)}
                                    onToggleLike={() => store.toggleLike(gen.id)}
                                    onRegenCover={() => handleRegenCover(gen)}
                                    allGenerations={store.generations}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
                {/* Bottom spacer for player clearance */}
                <div className="h-20"/>
            </div>

            <ConfirmDialog
                open={deleteTargetId !== null}
                title={t("history.deleteTrack")}
                message={t("history.deleteTrackMessage")}
                onConfirm={() => {
                    if (deleteTargetId !== null) {
                        store.deleteGeneration(deleteTargetId);
                    }
                    setDeleteTargetId(null);
                }}
                onCancel={() => setDeleteTargetId(null)}
            />
        </div>
    );
}

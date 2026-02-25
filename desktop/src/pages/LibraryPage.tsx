import {useCallback, useEffect, useRef, useState} from "react";
import {ChevronDown, LayoutGrid, List, Loader2, Search, SlidersHorizontal, Star, X,} from "lucide-react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {useLibraryStore} from "../stores/libraryStore";
import {usePlayerStore} from "../stores/playerStore";
import {useAppStore} from "../stores/appStore";
import {GENRE_OPTIONS} from "../stores/createStore";
import {useTrackActions} from "../hooks/useTrackActions";
import ConfirmDialog from "../components/ConfirmDialog";
import GridCard from "../components/library/GridCard";
import ListRow from "../components/library/ListRow";
import LoadingSkeleton from "../components/library/LoadingSkeleton";
import EmptyState from "../components/library/EmptyState";
import ErrorState from "../components/library/ErrorState";

// ---- Constants ----

const GENRE_FILTERS = GENRE_OPTIONS;

const SORT_OPTIONS = [
    {labelKey: "library.sort.newest", field: "created_at" as const, dir: "desc" as const},
    {labelKey: "library.sort.oldest", field: "created_at" as const, dir: "asc" as const},
    {labelKey: "library.sort.titleAZ", field: "title" as const, dir: "asc" as const},
    {labelKey: "library.sort.titleZA", field: "title" as const, dir: "desc" as const},
    {labelKey: "library.sort.longest", field: "actual_duration" as const, dir: "desc" as const},
    {labelKey: "library.sort.shortest", field: "actual_duration" as const, dir: "asc" as const},
];

// ---- Main Page ----

export default function LibraryPage() {
    const {t} = useTranslation();
    const store = useLibraryStore();
    const setQueue = usePlayerStore((s) => s.setQueue);
    const currentTrack = usePlayerStore((s) => s.currentTrack);
    const isPlaying = usePlayerStore((s) => s.isPlaying);
    const setCurrentPage = useAppStore((s) => s.setCurrentPage);
    const openDetail = useAppStore((s) => s.openDetail);
    const {handleExtend, handleRemix, handleRegenerateCover} = useTrackActions();
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const [showGenreFilter, setShowGenreFilter] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
    const genreRef = useRef<HTMLDivElement>(null);

    // Initial load
    useEffect(() => {
        store.fetchGenerations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Close genre dropdown on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (genreRef.current && !genreRef.current.contains(e.target as Node)) {
                setShowGenreFilter(false);
            }
        }

        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    const handleSearch = useCallback(
        (q: string) => {
            // Update the input immediately but debounce the API call
            useLibraryStore.setState((s) => ({
                filters: {...s.filters, search: q},
            }));
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                store.fetchGenerations();
            }, 300);
        },
        [store],
    );

    const handleToggleFavorites = useCallback(() => {
        store.setFilter("isLiked", !store.filters.isLiked);
    }, [store]);

    const handleGenreSelect = useCallback(
        (genre: string) => {
            store.setFilter("genre", store.filters.genre === genre ? "" : genre);
            setShowGenreFilter(false);
        },
        [store],
    );

    const handleStatusFilter = useCallback(
        (status: string) => {
            store.setFilter("status", store.filters.status === status ? "" : status);
        },
        [store],
    );

    const handleSortChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            const opt = SORT_OPTIONS[Number(e.target.value)];
            if (opt) store.setSort(opt.field, opt.dir);
        },
        [store],
    );

    const currentSortIndex = SORT_OPTIONS.findIndex(
        (o) => o.field === store.sortField && o.dir === store.sortDir,
    );

    const handleRegenCover = useCallback(
        (gen: Parameters<typeof handleRegenerateCover>[0]) =>
            handleRegenerateCover(gen, store.updateGeneration),
        [handleRegenerateCover, store.updateGeneration],
    );

    const hasActiveFilters =
        store.filters.search ||
        store.filters.isLiked ||
        store.filters.genre ||
        store.filters.mood ||
        store.filters.status;

    const hasMore = store.generations.length < store.total;

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 py-6">
                {/* Header */}
                <div className="flex items-end justify-between mb-5">
                    <div>
                        <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
                            {t("library.title")}
                        </h1>
                        <p className="text-[13px] text-text-tertiary mt-0.5">
                            {t("library.subtitle")}
                        </p>
                    </div>
                    <span
                        className="text-xs text-text-tertiary tabular-nums bg-surface-secondary px-2.5 py-1 rounded-lg">
            {store.total} {store.total !== 1 ? t("library.tracks") : t("library.track")}
          </span>
                </div>

                {/* Filter bar */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                    {/* Search */}
                    <div className="flex-1 min-w-[200px] relative">
                        <Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2"/>
                        <input
                            value={store.filters.search}
                            onChange={(e) => handleSearch(e.target.value)}
                            placeholder={t("library.searchPlaceholder")}
                            className="w-full pl-10 pr-3 py-2 rounded-xl border border-border bg-white
                         text-sm focus:outline-none focus:ring-2 focus:ring-primary-200
                         focus:border-primary-300 placeholder:text-text-tertiary/60"
                        />
                    </div>

                    {/* Favorites toggle */}
                    <button
                        onClick={handleToggleFavorites}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium
                       transition-colors cursor-pointer border
                       ${store.filters.isLiked
                            ? "bg-amber-50 text-amber-700 border-amber-200 shadow-sm"
                            : "bg-white text-text-secondary border-border hover:border-amber-200 hover:text-amber-600"
                        }`}
                    >
                        <Star
                            className={`w-4 h-4 ${store.filters.isLiked ? "fill-amber-500" : ""}`}
                        />
                        {t("library.favorites")}
                    </button>

                    {/* Genre filter dropdown */}
                    <div className="relative" ref={genreRef}>
                        <button
                            onClick={() => setShowGenreFilter(!showGenreFilter)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium
                         transition-colors cursor-pointer border
                         ${store.filters.genre
                                ? "bg-primary-50 text-primary-700 border-primary-200 shadow-sm"
                                : "bg-white text-text-secondary border-border hover:border-primary-200"
                            }`}
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5"/>
                            {store.filters.genre ? t(`tags.genres.${store.filters.genre}`, store.filters.genre) : t("library.genre")}
                            <ChevronDown className="w-3 h-3"/>
                        </button>
                        <AnimatePresence>
                            {showGenreFilter && (
                                <motion.div
                                    initial={{opacity: 0, y: -4}}
                                    animate={{opacity: 1, y: 0}}
                                    exit={{opacity: 0, y: -4}}
                                    className="absolute top-full mt-1 left-0 z-40 bg-white rounded-xl border
                             border-border shadow-lg p-2 min-w-[160px]"
                                >
                                    {store.filters.genre && (
                                        <button
                                            onClick={() => handleGenreSelect("")}
                                            className="w-full text-left px-3 py-1.5 rounded-lg text-xs
                                 text-red-500 hover:bg-red-50 cursor-pointer mb-1"
                                        >
                                            {t("library.clearFilter")}
                                        </button>
                                    )}
                                    {GENRE_FILTERS.map((g) => (
                                        <button
                                            key={g}
                                            onClick={() => handleGenreSelect(g)}
                                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs
                                 transition-colors cursor-pointer
                                 ${store.filters.genre === g
                                                ? "bg-primary-50 text-primary-700 font-medium"
                                                : "text-text-secondary hover:bg-surface-secondary"
                                            }`}
                                        >
                                            {t(`tags.genres.${g}`, g)}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Sort */}
                    <div className="relative">
                        <select
                            value={currentSortIndex >= 0 ? currentSortIndex : 0}
                            onChange={handleSortChange}
                            className="appearance-none px-3 py-2 pr-8 rounded-xl border border-border
                         bg-white text-sm text-text-secondary
                         focus:outline-none focus:ring-2 focus:ring-primary-200
                         cursor-pointer"
                        >
                            {SORT_OPTIONS.map((opt, i) => (
                                <option key={i} value={i}>
                                    {t(opt.labelKey)}
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2
                                    w-3.5 h-3.5 text-text-tertiary pointer-events-none"/>
                    </div>

                    {/* View mode */}
                    <div className="flex bg-surface-secondary rounded-lg p-0.5 border border-border">
                        <button
                            onClick={() => store.setViewMode("grid")}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer
                         ${store.viewMode === "grid"
                                ? "bg-white text-primary-600 shadow-sm"
                                : "text-text-tertiary hover:text-text-secondary"
                            }`}
                            title={t("library.gridView")}
                        >
                            <LayoutGrid className="w-4 h-4"/>
                        </button>
                        <button
                            onClick={() => store.setViewMode("list")}
                            className={`p-1.5 rounded-md transition-colors cursor-pointer
                         ${store.viewMode === "list"
                                ? "bg-white text-primary-600 shadow-sm"
                                : "text-text-tertiary hover:text-text-secondary"
                            }`}
                            title={t("library.listView")}
                        >
                            <List className="w-4 h-4"/>
                        </button>
                    </div>
                </div>

                {/* Status filter tabs */}
                <div className="flex items-center gap-1.5 mb-5">
                    {[
                        {key: "", labelKey: "library.all"},
                        {key: "completed", labelKey: "library.completed"},
                        {key: "processing", labelKey: "library.processing"},
                        {key: "failed", labelKey: "library.failed"},
                    ].map(({key, labelKey}) => (
                        <button
                            key={key}
                            onClick={() => handleStatusFilter(key)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer
                         ${store.filters.status === key || (!store.filters.status && !key)
                                ? "bg-primary-100 text-primary-700"
                                : "text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary"
                            }`}
                        >
                            {t(labelKey)}
                        </button>
                    ))}
                    {hasActiveFilters && (
                        <button
                            onClick={() => store.clearFilters()}
                            className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                         text-text-tertiary hover:text-red-500 hover:bg-red-50
                         transition-colors cursor-pointer"
                        >
                            <X className="w-3 h-3"/>
                            {t("library.clearAll")}
                        </button>
                    )}
                </div>

                {/* Content */}
                {store.loading && store.generations.length === 0 ? (
                    <LoadingSkeleton viewMode={store.viewMode}/>
                ) : store.error ? (
                    <ErrorState
                        error={t(store.error)}
                        onRetry={() => store.fetchGenerations()}
                    />
                ) : store.generations.length === 0 ? (
                    <EmptyState
                        hasFilters={!!hasActiveFilters}
                        isLikedFilter={store.filters.isLiked}
                        onClearFilters={() => store.clearFilters()}
                        onGoCreate={() => setCurrentPage("create")}
                    />
                ) : store.viewMode === "grid" ? (
                    /* Grid View */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {store.generations.map((gen, idx) => (
                            <GridCard
                                key={gen.id}
                                gen={gen}
                                isCurrentTrack={currentTrack?.id === gen.id}
                                isPlaying={currentTrack?.id === gen.id && isPlaying}
                                onPlay={() => setQueue(store.generations, idx)}
                                onToggleLike={() => store.toggleLike(gen.id)}
                                onDelete={() => setDeleteTargetId(gen.id)}
                                onExtend={() => handleExtend(gen)}
                                onRemix={() => handleRemix(gen)}
                                onRegenCover={() => handleRegenCover(gen)}
                                onOpenDetail={() => openDetail(gen.id)}
                            />
                        ))}
                    </div>
                ) : (
                    /* List View */
                    <div className="space-y-1">
                        {/* List header */}
                        <div className="flex items-center gap-3 px-4 py-2 text-[11px]
                            font-medium text-text-tertiary uppercase tracking-wider">
                            <span className="w-10"/>
                            <span className="flex-1">{t("library.listTitle")}</span>
                            <span className="w-24 text-center">{t("library.listGenre")}</span>
                            <span className="w-20 text-center">{t("library.listMood")}</span>
                            <span className="w-16 text-center">{t("library.listDuration")}</span>
                            <span className="w-24 text-center">{t("library.listDate")}</span>
                            <span className="w-20"/>
                        </div>
                        {store.generations.map((gen, idx) => (
                            <ListRow
                                key={gen.id}
                                gen={gen}
                                isCurrentTrack={currentTrack?.id === gen.id}
                                isPlaying={currentTrack?.id === gen.id && isPlaying}
                                onPlay={() => setQueue(store.generations, idx)}
                                onToggleLike={() => store.toggleLike(gen.id)}
                                onDelete={() => setDeleteTargetId(gen.id)}
                                onExtend={() => handleExtend(gen)}
                                onRemix={() => handleRemix(gen)}
                                onRegenCover={() => handleRegenCover(gen)}
                                onOpenDetail={() => openDetail(gen.id)}
                            />
                        ))}
                    </div>
                )}

                {/* Load more */}
                {hasMore && !store.loading && store.generations.length > 0 && (
                    <div className="flex justify-center mt-6">
                        <button
                            onClick={() => store.loadMore()}
                            className="px-6 py-2.5 rounded-xl border border-border bg-white
                         text-sm font-medium text-text-secondary
                         hover:bg-surface-secondary transition-colors cursor-pointer"
                        >
                            {t("library.loadMore")}
                        </button>
                    </div>
                )}
                {store.loading && store.generations.length > 0 && (
                    <div className="flex justify-center mt-6">
                        <Loader2 className="w-5 h-5 animate-spin text-text-tertiary"/>
                    </div>
                )}

                {/* Bottom spacer */}
                <div className="h-24"/>
            </div>

            <ConfirmDialog
                open={deleteTargetId !== null}
                title={t("library.deleteTrack")}
                message={t("library.deleteTrackMessage")}
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

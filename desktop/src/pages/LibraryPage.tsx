import { useEffect, useCallback, useRef, useState } from "react";
import {
  Search,
  Star,
  Play,
  Trash2,
  Clock,
  Music,
  Heart,
  LayoutGrid,
  List,
  ChevronDown,
  Loader2,
  Sparkles,
  Repeat,
  Shuffle,
  Image,
  GitBranch,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLibraryStore } from "../stores/libraryStore";
import { usePlayerStore } from "../stores/playerStore";
import { useAppStore } from "../stores/appStore";
import { useCreateStore } from "../stores/createStore";
import { api } from "../services/api";
import type { Generation } from "../types";

// ---- Constants ----

const GENRE_FILTERS = [
  "Pop", "Rock", "Jazz", "Electronic", "Hip-Hop", "R&B",
  "Classical", "Lo-fi", "Ambient", "Metal", "Indie",
];

const SORT_OPTIONS = [
  { label: "Newest", field: "created_at" as const, dir: "desc" as const },
  { label: "Oldest", field: "created_at" as const, dir: "asc" as const },
  { label: "Title A-Z", field: "title" as const, dir: "asc" as const },
  { label: "Title Z-A", field: "title" as const, dir: "desc" as const },
  { label: "Longest", field: "actual_duration" as const, dir: "desc" as const },
  { label: "Shortest", field: "actual_duration" as const, dir: "asc" as const },
];

const genreGradients: Record<string, string> = {
  electronic: "from-indigo-500 to-violet-600",
  rock: "from-red-500 to-orange-500",
  pop: "from-pink-500 to-rose-400",
  jazz: "from-amber-500 to-yellow-600",
  classical: "from-cyan-600 to-teal-500",
  hiphop: "from-violet-600 to-purple-400",
  lofi: "from-teal-500 to-emerald-400",
  ambient: "from-sky-500 to-blue-400",
  metal: "from-zinc-600 to-gray-500",
  indie: "from-slate-500 to-gray-400",
  "r&b": "from-purple-500 to-pink-400",
};

// ---- Helpers ----

function getGradient(genre?: string): string {
  if (!genre) return "from-primary-500 to-primary-700";
  const key = genre.toLowerCase().replace(/[\s-_]/g, "");
  for (const [k, v] of Object.entries(genreGradients)) {
    if (key.includes(k)) return v;
  }
  return "from-primary-500 to-primary-700";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSeconds(sec?: number): string {
  if (!sec) return "--";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ---- Main Page ----

export default function LibraryPage() {
  const store = useLibraryStore();
  const play = usePlayerStore((s) => s.play);
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const createStore = useCreateStore();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showGenreFilter, setShowGenreFilter] = useState(false);
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
        filters: { ...s.filters, search: q },
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

  const handleExtend = useCallback(
    (gen: Generation) => {
      createStore.reset();
      createStore.setPrompt(gen.prompt || "");
      createStore.setTitle(gen.title ? `${gen.title} (Extended)` : "");
      createStore.setLyrics(gen.lyrics || "");
      if (gen.genre) {
        for (const g of gen.genre.split(",").map((s) => s.trim()))
          createStore.toggleGenre(g);
      }
      if (gen.mood) {
        for (const m of gen.mood.split(",").map((s) => s.trim()))
          createStore.toggleMood(m);
      }
      if (gen.tempo) createStore.setTempo(gen.tempo);
      if (gen.musical_key) createStore.setMusicalKey(gen.musical_key);
      setCurrentPage("create");
    },
    [createStore, setCurrentPage],
  );

  const handleRemix = useCallback(
    (gen: Generation) => {
      createStore.reset();
      createStore.setPrompt(gen.prompt ? `Remix: ${gen.prompt}` : "");
      createStore.setTitle(gen.title ? `${gen.title} (Remix)` : "");
      if (gen.genre) {
        for (const g of gen.genre.split(",").map((s) => s.trim()))
          createStore.toggleGenre(g);
      }
      if (gen.mood) {
        for (const m of gen.mood.split(",").map((s) => s.trim()))
          createStore.toggleMood(m);
      }
      if (gen.tempo) createStore.setTempo(gen.tempo);
      if (gen.musical_key) createStore.setMusicalKey(gen.musical_key);
      createStore.setMode("custom");
      setCurrentPage("create");
    },
    [createStore, setCurrentPage],
  );

  const handleRegenCover = useCallback(
    async (gen: Generation) => {
      try {
        const res = await api.regenerateCover({
          generation_id: gen.id,
          title: gen.title || undefined,
          genre: gen.genre || undefined,
          mood: gen.mood || undefined,
          lyrics: gen.lyrics || undefined,
        });
        store.updateGeneration(gen.id, {
          cover_art_path: res.cover_art_path,
        });
      } catch {
        /* noop */
      }
    },
    [store],
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
              Library
            </h1>
            <p className="text-[13px] text-text-tertiary mt-0.5">
              Your music collection
            </p>
          </div>
          <span className="text-xs text-text-tertiary tabular-nums bg-surface-secondary px-2.5 py-1 rounded-lg">
            {store.total} track{store.total !== 1 && "s"}
          </span>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 text-text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={store.filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by title, genre, mood..."
              className="w-full pl-10 pr-3 py-2 rounded-xl border border-border bg-white
                         text-sm focus:outline-none focus:ring-2 focus:ring-primary-200
                         focus:border-primary-300 placeholder:text-text-tertiary/60"
            />
          </div>

          {/* Favorites toggle */}
          <button
            onClick={handleToggleFavorites}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium
                       transition-all cursor-pointer border
                       ${store.filters.isLiked
                         ? "bg-amber-50 text-amber-700 border-amber-200 shadow-sm"
                         : "bg-white text-text-secondary border-border hover:border-amber-200 hover:text-amber-600"
                       }`}
          >
            <Star
              className={`w-4 h-4 ${store.filters.isLiked ? "fill-amber-500" : ""}`}
            />
            Favorites
          </button>

          {/* Genre filter dropdown */}
          <div className="relative" ref={genreRef}>
            <button
              onClick={() => setShowGenreFilter(!showGenreFilter)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium
                         transition-all cursor-pointer border
                         ${store.filters.genre
                           ? "bg-primary-50 text-primary-700 border-primary-200 shadow-sm"
                           : "bg-white text-text-secondary border-border hover:border-primary-200"
                         }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {store.filters.genre || "Genre"}
              <ChevronDown className="w-3 h-3" />
            </button>
            <AnimatePresence>
              {showGenreFilter && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full mt-1 left-0 z-40 bg-white rounded-xl border
                             border-border shadow-lg p-2 min-w-[160px]"
                >
                  {store.filters.genre && (
                    <button
                      onClick={() => handleGenreSelect("")}
                      className="w-full text-left px-3 py-1.5 rounded-lg text-xs
                                 text-red-500 hover:bg-red-50 cursor-pointer mb-1"
                    >
                      Clear filter
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
                      {g}
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
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2
                                    w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
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
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => store.setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors cursor-pointer
                         ${store.viewMode === "list"
                           ? "bg-white text-primary-600 shadow-sm"
                           : "text-text-tertiary hover:text-text-secondary"
                         }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1.5 mb-5">
          {[
            { key: "", label: "All" },
            { key: "completed", label: "Completed" },
            { key: "processing", label: "Processing" },
            { key: "failed", label: "Failed" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleStatusFilter(key)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer
                         ${store.filters.status === key || (!store.filters.status && !key)
                           ? "bg-primary-100 text-primary-700"
                           : "text-text-tertiary hover:text-text-secondary hover:bg-surface-secondary"
                         }`}
            >
              {label}
            </button>
          ))}
          {hasActiveFilters && (
            <button
              onClick={() => store.clearFilters()}
              className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full text-xs
                         text-text-tertiary hover:text-red-500 hover:bg-red-50
                         transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              Clear all
            </button>
          )}
        </div>

        {/* Content */}
        {store.loading && store.generations.length === 0 ? (
          <LoadingSkeleton viewMode={store.viewMode} />
        ) : store.error ? (
          <ErrorState
            error={store.error}
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
            {store.generations.map((gen) => (
              <GridCard
                key={gen.id}
                gen={gen}
                isCurrentTrack={currentTrack?.id === gen.id}
                isPlaying={currentTrack?.id === gen.id && isPlaying}
                onPlay={() => play(gen)}
                onToggleLike={() => store.toggleLike(gen.id)}
                onDelete={() => store.deleteGeneration(gen.id)}
                onExtend={() => handleExtend(gen)}
                onRemix={() => handleRemix(gen)}
                onRegenCover={() => handleRegenCover(gen)}
              />
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-1">
            {/* List header */}
            <div className="flex items-center gap-3 px-4 py-2 text-[11px]
                            font-medium text-text-tertiary uppercase tracking-wider">
              <span className="w-10" />
              <span className="flex-1">Title</span>
              <span className="w-24 text-center">Genre</span>
              <span className="w-20 text-center">Mood</span>
              <span className="w-16 text-center">Duration</span>
              <span className="w-24 text-center">Date</span>
              <span className="w-20" />
            </div>
            {store.generations.map((gen) => (
              <ListRow
                key={gen.id}
                gen={gen}
                isCurrentTrack={currentTrack?.id === gen.id}
                isPlaying={currentTrack?.id === gen.id && isPlaying}
                onPlay={() => play(gen)}
                onToggleLike={() => store.toggleLike(gen.id)}
                onDelete={() => store.deleteGeneration(gen.id)}
                onExtend={() => handleExtend(gen)}
                onRemix={() => handleRemix(gen)}
                onRegenCover={() => handleRegenCover(gen)}
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
              Load more
            </button>
          </div>
        )}
        {store.loading && store.generations.length > 0 && (
          <div className="flex justify-center mt-6">
            <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
          </div>
        )}

        {/* Bottom spacer */}
        <div className="h-24" />
      </div>
    </div>
  );
}

// ---- Grid Card ----

function GridCard({
  gen,
  isCurrentTrack,
  isPlaying,
  onPlay,
  onToggleLike,
  onDelete,
  onExtend,
  onRemix,
  onRegenCover,
}: {
  gen: Generation;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onToggleLike: () => void;
  onDelete: () => void;
  onExtend: () => void;
  onRemix: () => void;
  onRegenCover: () => void;
}) {
  const gradient = getGradient(gen.genre);
  const hasCover = !!gen.cover_art_path;
  const displayTitle = gen.title || gen.prompt.slice(0, 50);
  const [coverLoading, setCoverLoading] = useState(false);

  const handleRegenCover = async () => {
    setCoverLoading(true);
    await onRegenCover();
    setCoverLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden
                  hover:shadow-md transition-all group
                  ${isCurrentTrack ? "border-primary-300 ring-1 ring-primary-200" : "border-border"}`}
    >
      {/* Cover */}
      <div
        className={`h-32 ${hasCover ? "" : `bg-gradient-to-br ${gradient}`}
                    flex items-center justify-center relative overflow-hidden`}
      >
        {hasCover ? (
          <img
            src={api.getCoverArtUrl(gen.cover_art_path!)}
            alt="Cover"
            className={`w-full h-full object-cover transition-opacity
                       ${coverLoading ? "opacity-40" : ""}`}
          />
        ) : (
          <Music className="w-8 h-8 text-white/20" />
        )}
        {coverLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
          </div>
        )}

        {/* Play overlay */}
        <button
          onClick={onPlay}
          disabled={gen.status !== "completed"}
          className="absolute inset-0 flex items-center justify-center
                     bg-black/0 group-hover:bg-black/25
                     transition-all cursor-pointer disabled:cursor-not-allowed"
        >
          <div
            className={`w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm
                       flex items-center justify-center shadow-lg
                       transition-all
                       ${isCurrentTrack && isPlaying
                         ? "opacity-100 scale-100"
                         : "opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
                       }`}
          >
            {isCurrentTrack && isPlaying ? (
              <div className="flex items-center gap-[3px]">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-[3px] rounded-full bg-primary-600"
                    animate={{ height: [6, 14, 6] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                  />
                ))}
              </div>
            ) : (
              <Play className="w-5 h-5 text-primary-600 ml-0.5" />
            )}
          </div>
        </button>

        {/* Star/like */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleLike();
          }}
          className="absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-sm
                     bg-black/10 hover:bg-black/20 transition-all cursor-pointer"
        >
          <Star
            className={`w-3.5 h-3.5 transition-colors
                       ${gen.is_liked
                         ? "fill-amber-400 text-amber-400"
                         : "text-white/80 hover:text-white"
                       }`}
          />
        </button>

        {/* Status badge (only if not completed) */}
        {gen.status !== "completed" && (
          <span
            className={`absolute top-2.5 left-2.5 text-[10px] px-2 py-0.5
                        rounded-full font-semibold backdrop-blur-sm
                        ${gen.status === "failed"
                          ? "bg-red-500/30 text-white"
                          : "bg-amber-500/30 text-white"
                        }`}
          >
            {gen.status}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-[13px] font-semibold text-text-primary truncate mb-1 leading-tight">
          {displayTitle}
        </p>

        {gen.parent_id && gen.parent_type && (
          <p className="text-[10px] text-text-tertiary flex items-center gap-1 mb-2">
            <GitBranch className="w-2.5 h-2.5" />
            {gen.parent_type === "extend" ? "Extended" : "Remix"}
          </p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {gen.genre && (
            <span className="text-[11px] px-2 py-0.5 rounded-full
                             bg-primary-50 text-primary-600 font-medium">
              {gen.genre}
            </span>
          )}
          {gen.mood && (
            <span className="text-[11px] px-2 py-0.5 rounded-full
                             bg-accent-50 text-accent-500 font-medium">
              {gen.mood}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px] text-text-tertiary ml-auto tabular-nums">
            <Clock className="w-3 h-3" />
            {formatSeconds(gen.actual_duration)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-tertiary">
            {formatDate(gen.created_at)}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
            <button
              onClick={onExtend}
              title="Extend"
              className="p-1.5 rounded-lg hover:bg-primary-50 transition-colors cursor-pointer"
            >
              <Repeat className="w-3.5 h-3.5 text-text-tertiary hover:text-primary-600" />
            </button>
            <button
              onClick={onRemix}
              title="Remix"
              className="p-1.5 rounded-lg hover:bg-accent-50 transition-colors cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5 text-text-tertiary hover:text-accent-500" />
            </button>
            <button
              onClick={handleRegenCover}
              title="Regenerate Cover"
              className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
            >
              <Image className="w-3.5 h-3.5 text-text-tertiary hover:text-blue-500" />
            </button>
            <button
              onClick={onDelete}
              title="Delete"
              className="p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-text-tertiary hover:text-red-500" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---- List Row ----

function ListRow({
  gen,
  isCurrentTrack,
  isPlaying,
  onPlay,
  onToggleLike,
  onDelete,
  onExtend,
  onRemix,
  onRegenCover,
}: {
  gen: Generation;
  isCurrentTrack: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onToggleLike: () => void;
  onDelete: () => void;
  onExtend: () => void;
  onRemix: () => void;
  onRegenCover: () => void;
}) {
  const gradient = getGradient(gen.genre);
  const hasCover = !!gen.cover_art_path;
  const displayTitle = gen.title || gen.prompt.slice(0, 50);
  const [coverLoading, setCoverLoading] = useState(false);

  const handleRegenCover = async () => {
    setCoverLoading(true);
    await onRegenCover();
    setCoverLoading(false);
  };

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all
                  group hover:bg-surface-secondary cursor-pointer
                  ${isCurrentTrack ? "bg-primary-50/50" : ""}`}
      onClick={gen.status === "completed" ? onPlay : undefined}
    >
      {/* Thumbnail */}
      <div
        className={`w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden relative
                    ${hasCover ? "" : `bg-gradient-to-br ${gradient}`}
                    flex items-center justify-center`}
      >
        {hasCover ? (
          <img
            src={api.getCoverArtUrl(gen.cover_art_path!)}
            alt=""
            className={`w-full h-full object-cover ${coverLoading ? "opacity-40" : ""}`}
          />
        ) : (
          <Music className="w-4 h-4 text-white/30" />
        )}
        {/* Mini play indicator */}
        {isCurrentTrack && isPlaying && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="flex items-center gap-[2px]">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-[2px] rounded-full bg-white"
                  animate={{ height: [4, 10, 4] }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.15,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Title + lineage */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate leading-tight
                     ${isCurrentTrack ? "text-primary-700" : "text-text-primary"}`}
        >
          {displayTitle}
        </p>
        {gen.parent_type && (
          <p className="text-[10px] text-text-tertiary flex items-center gap-1 mt-0.5">
            <GitBranch className="w-2.5 h-2.5" />
            {gen.parent_type === "extend" ? "Extended" : "Remix"}
          </p>
        )}
      </div>

      {/* Genre */}
      <span className="w-24 text-center">
        {gen.genre ? (
          <span className="text-[11px] px-2 py-0.5 rounded-full
                           bg-primary-50 text-primary-600 font-medium">
            {gen.genre}
          </span>
        ) : (
          <span className="text-[11px] text-text-tertiary">--</span>
        )}
      </span>

      {/* Mood */}
      <span className="w-20 text-center">
        {gen.mood ? (
          <span className="text-[11px] px-2 py-0.5 rounded-full
                           bg-accent-50 text-accent-500 font-medium">
            {gen.mood}
          </span>
        ) : (
          <span className="text-[11px] text-text-tertiary">--</span>
        )}
      </span>

      {/* Duration */}
      <span className="w-16 text-center text-[12px] text-text-tertiary tabular-nums">
        {formatSeconds(gen.actual_duration)}
      </span>

      {/* Date */}
      <span className="w-24 text-center text-[11px] text-text-tertiary">
        {formatDate(gen.created_at)}
      </span>

      {/* Actions */}
      <div
        className="w-20 flex items-center justify-end gap-0.5
                    opacity-0 group-hover:opacity-100 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onToggleLike}
          className="p-1 rounded-md hover:bg-amber-50 transition-colors cursor-pointer"
          title={gen.is_liked ? "Unfavorite" : "Favorite"}
        >
          <Star
            className={`w-3.5 h-3.5 ${gen.is_liked
              ? "fill-amber-400 text-amber-400"
              : "text-text-tertiary hover:text-amber-500"
            }`}
          />
        </button>
        <button
          onClick={onExtend}
          title="Extend"
          className="p-1 rounded-md hover:bg-primary-50 transition-colors cursor-pointer"
        >
          <Repeat className="w-3.5 h-3.5 text-text-tertiary hover:text-primary-600" />
        </button>
        <button
          onClick={onRemix}
          title="Remix"
          className="p-1 rounded-md hover:bg-accent-50 transition-colors cursor-pointer"
        >
          <Shuffle className="w-3.5 h-3.5 text-text-tertiary hover:text-accent-500" />
        </button>
        <button
          onClick={handleRegenCover}
          title="Regenerate Cover"
          className="p-1 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
        >
          <Image className="w-3.5 h-3.5 text-text-tertiary hover:text-blue-500" />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5 text-text-tertiary hover:text-red-500" />
        </button>
      </div>
    </div>
  );
}

// ---- Loading Skeleton ----

function LoadingSkeleton({ viewMode }: { viewMode: "grid" | "list" }) {
  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="w-10 h-10 bg-surface-tertiary rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 bg-surface-tertiary rounded-lg w-48" />
              <div className="h-3 bg-surface-tertiary rounded w-24" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-pulse"
        >
          <div className="h-32 bg-surface-tertiary" />
          <div className="p-4 space-y-2.5">
            <div className="h-4 bg-surface-tertiary rounded-lg w-3/4" />
            <div className="flex gap-2">
              <div className="h-5 bg-surface-tertiary rounded-full w-16" />
              <div className="h-5 bg-surface-tertiary rounded-full w-14" />
            </div>
            <div className="h-3 bg-surface-tertiary rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Empty State ----

function EmptyState({
  hasFilters,
  isLikedFilter,
  onClearFilters,
  onGoCreate,
}: {
  hasFilters: boolean;
  isLikedFilter: boolean;
  onClearFilters: () => void;
  onGoCreate: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-20"
    >
      <div
        className={`w-16 h-16 rounded-2xl flex items-center justify-center
                    mx-auto mb-4 border ${
          isLikedFilter
            ? "bg-amber-50 border-amber-100"
            : hasFilters
              ? "bg-surface-secondary border-border"
              : "bg-primary-50 border-primary-100"
        }`}
      >
        {isLikedFilter ? (
          <Star className="w-7 h-7 text-amber-400" />
        ) : (
          <Music className="w-7 h-7 text-primary-400" />
        )}
      </div>
      <p className="text-text-primary font-semibold mb-1">
        {isLikedFilter
          ? "No favorites yet"
          : hasFilters
            ? "No matching tracks"
            : "No tracks yet"}
      </p>
      <p className="text-text-tertiary text-[13px] mb-5 max-w-xs mx-auto">
        {isLikedFilter
          ? "Star the songs you love and they'll appear here"
          : hasFilters
            ? "Try adjusting your filters or search term"
            : "Create your first song to build your music collection"}
      </p>
      {hasFilters ? (
        <button
          onClick={onClearFilters}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                     bg-white border border-border text-sm font-medium
                     text-text-secondary hover:bg-surface-secondary
                     transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
          Clear filters
        </button>
      ) : (
        <button
          onClick={onGoCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                     bg-primary-600 text-white text-sm font-medium
                     hover:bg-primary-700 transition-colors cursor-pointer shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          Create Music
        </button>
      )}
    </motion.div>
  );
}

// ---- Error State ----

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-20"
    >
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center
                      mx-auto mb-4 border border-red-100">
        <Music className="w-7 h-7 text-red-400" />
      </div>
      <p className="text-text-primary font-semibold mb-1">Connection Error</p>
      <p className="text-text-tertiary text-[13px] mb-5">{error}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                   bg-primary-600 text-white text-sm font-medium
                   hover:bg-primary-700 transition-colors cursor-pointer shadow-sm"
      >
        Retry
      </button>
    </motion.div>
  );
}

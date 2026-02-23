import { useEffect, useState, useMemo } from "react";
import {
  Play,
  Trash2,
  Clock,
  Music,
  Search,
  ArrowUpDown,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Generation } from "../types";
import { api } from "../services/api";
import { usePlayerStore } from "../stores/playerStore";
import { useAppStore } from "../stores/appStore";

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

const genreGradients: Record<string, string> = {
  electronic: "from-indigo-500 to-violet-600",
  rock: "from-red-500 to-orange-500",
  pop: "from-pink-500 to-rose-400",
  jazz: "from-amber-500 to-yellow-600",
  classical: "from-cyan-600 to-teal-500",
  hiphop: "from-violet-600 to-purple-400",
};

function getGradient(genre?: string): string {
  if (!genre) return "from-primary-500 to-primary-700";
  const key = genre.toLowerCase().replace(/[\s-_]/g, "");
  for (const [k, v] of Object.entries(genreGradients)) {
    if (key.includes(k)) return v;
  }
  return "from-primary-500 to-primary-700";
}

type SortKey = "date" | "name";

export default function HistoryPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const play = usePlayerStore((s) => s.play);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  useEffect(() => {
    loadGenerations();
  }, []);

  const loadGenerations = async () => {
    setLoading(true);
    try {
      const data = await api.getGenerations();
      setGenerations(data);
    } catch {
      // Backend might not be running
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteGeneration(id);
      setGenerations((g) => g.filter((x) => x.id !== id));
    } catch {
      // Silent fail
    }
  };

  const filtered = useMemo(() => {
    let list = generations;
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
  }, [generations, search, sortBy]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-[22px] font-bold text-text-primary tracking-tight mb-0.5">
              History
            </h1>
            <p className="text-[13px] text-text-tertiary">
              Your generated tracks
            </p>
          </div>
          <span className="text-xs text-text-tertiary tabular-nums">
            {generations.length} track{generations.length !== 1 && "s"}
          </span>
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-text-tertiary absolute
                               left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tracks..."
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
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortBy === "date" ? "Date" : "Name"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-primary-200
                            border-t-primary-600 rounded-full
                            animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-24"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary-50
                            flex items-center justify-center
                            mx-auto mb-4 border border-primary-100">
              <Music className="w-7 h-7 text-primary-400" />
            </div>
            <p className="text-text-primary font-semibold mb-1">
              {search ? "No matching tracks" : "No tracks yet"}
            </p>
            <p className="text-text-tertiary text-[13px] mb-5">
              {search
                ? "Try a different search term"
                : "Create your first song to get started"}
            </p>
            {!search && (
              <button
                onClick={() => setCurrentPage("create")}
                className="inline-flex items-center gap-2 px-5 py-2.5
                           rounded-xl bg-primary-600 text-white
                           text-sm font-medium hover:bg-primary-700
                           transition-colors cursor-pointer shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                Create Music
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
                  onPlay={() => play(gen)}
                  onDelete={() => handleDelete(gen.id)}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Card ---- */
function HistoryCard({
  gen,
  index,
  onPlay,
  onDelete,
}: {
  gen: Generation;
  index: number;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const gradient = getGradient(gen.genre);
  const hasCover = !!gen.cover_art_path;
  const displayTitle = gen.title || gen.prompt.slice(0, 50);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white rounded-2xl border border-border shadow-sm
                 overflow-hidden hover:shadow-md transition-all
                 group"
    >
      {/* Cover header */}
      <div
        className={`h-24 ${hasCover ? "" : `bg-gradient-to-br ${gradient}`}
                    flex items-center justify-center relative overflow-hidden`}
      >
        {hasCover ? (
          <img
            src={api.getCoverArtUrl(gen.cover_art_path!)}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <Music className="w-8 h-8 text-white/20" />
        )}
        {/* Play overlay */}
        <button
          onClick={onPlay}
          disabled={gen.status !== "completed"}
          className="absolute inset-0 flex items-center justify-center
                     bg-black/0 group-hover:bg-black/25
                     transition-all cursor-pointer
                     disabled:cursor-not-allowed"
        >
          <div className="w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm
                          flex items-center justify-center
                          opacity-0 group-hover:opacity-100
                          transition-all shadow-lg
                          scale-75 group-hover:scale-100">
            <Play className="w-5 h-5 text-primary-600 ml-0.5" />
          </div>
        </button>
        {/* Status badge */}
        <span
          className={`absolute top-2.5 right-2.5 text-[10px] px-2 py-0.5
                      rounded-full font-semibold backdrop-blur-sm ${
            gen.status === "completed"
              ? "bg-white/25 text-white"
              : gen.status === "failed"
                ? "bg-red-500/30 text-white"
                : "bg-amber-500/30 text-white"
          }`}
        >
          {gen.status}
        </span>
      </div>

      {/* Card body */}
      <div className="p-4">
        <p className="text-[13px] font-semibold text-text-primary
                      truncate mb-2 leading-tight">
          {displayTitle}
        </p>
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
          <span className="flex items-center gap-1 text-[11px]
                           text-text-tertiary ml-auto tabular-nums">
            <Clock className="w-3 h-3" />
            {formatSeconds(gen.actual_duration)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-tertiary">
            {formatDate(gen.created_at)}
          </span>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50
                       transition-all cursor-pointer opacity-0
                       group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5 text-text-tertiary
                               hover:text-red-500 transition-colors" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

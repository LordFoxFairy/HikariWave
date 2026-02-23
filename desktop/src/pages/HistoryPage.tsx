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
      /* TODO: error handling */
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteGeneration(id);
      setGenerations((g) => g.filter((x) => x.id !== id));
    } catch {
      /* TODO */
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
          g.mood?.toLowerCase().includes(q),
      );
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.prompt.localeCompare(b.prompt);
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
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-1">
              History
            </h1>
            <p className="text-sm text-text-secondary">
              Your generated tracks
            </p>
          </div>
          <span className="text-xs text-text-tertiary">
            {generations.length} track{generations.length !== 1 && "s"}
          </span>
        </div>

        {/* Search + sort bar */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-text-tertiary absolute
                               left-3 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by prompt, genre, mood..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border
                         border-border bg-white text-sm
                         focus:outline-none focus:ring-2
                         focus:ring-primary-300 focus:border-primary-400
                         placeholder:text-text-tertiary"
            />
          </div>
          <button
            onClick={() =>
              setSortBy((s) => (s === "date" ? "name" : "date"))
            }
            className="flex items-center gap-1.5 px-3 py-2
                       rounded-lg border border-border bg-white
                       text-sm text-text-secondary
                       hover:bg-surface-tertiary transition-colors
                       cursor-pointer"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortBy === "date" ? "Date" : "Name"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary-300
                            border-t-primary-600 rounded-full
                            animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary-50
                            flex items-center justify-center
                            mx-auto mb-4">
              <Music className="w-8 h-8 text-primary-400" />
            </div>
            <p className="text-text-primary font-medium mb-1">
              {search ? "No matching tracks" : "No tracks yet"}
            </p>
            <p className="text-text-secondary text-sm mb-5">
              {search
                ? "Try a different search term"
                : "Create your first song to get started"}
            </p>
            {!search && (
              <button
                onClick={() => setCurrentPage("create")}
                className="inline-flex items-center gap-2 px-4 py-2
                           rounded-lg bg-primary-600 text-white
                           text-sm font-medium hover:bg-primary-700
                           transition-colors cursor-pointer"
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

/* ---- Card sub-component ---- */
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.04 }}
      className="bg-white rounded-xl border border-border shadow-sm
                 overflow-hidden hover:shadow-md transition-shadow
                 group"
    >
      {/* Gradient header */}
      <div
        className={`h-20 bg-gradient-to-br ${gradient}
                    flex items-center justify-center relative`}
      >
        <Music className="w-7 h-7 text-white/30" />
        {/* Play overlay */}
        <button
          onClick={onPlay}
          disabled={gen.status !== "completed"}
          className="absolute inset-0 flex items-center justify-center
                     bg-black/0 group-hover:bg-black/20
                     transition-colors cursor-pointer
                     disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 rounded-full bg-white/90
                          flex items-center justify-center
                          opacity-0 group-hover:opacity-100
                          transition-opacity shadow-lg
                          scale-90 group-hover:scale-100">
            <Play className="w-4 h-4 text-text-primary ml-0.5" />
          </div>
        </button>
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 text-[10px] px-2 py-0.5
                      rounded-full font-medium backdrop-blur-sm ${
            gen.status === "completed"
              ? "bg-green-500/20 text-white"
              : gen.status === "failed"
                ? "bg-red-500/20 text-white"
                : "bg-amber-500/20 text-white"
          }`}
        >
          {gen.status}
        </span>
      </div>

      {/* Card body */}
      <div className="p-4">
        <p className="text-sm font-medium text-text-primary
                      truncate mb-2">
          {gen.prompt.slice(0, 60)}
        </p>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {gen.genre && (
            <span className="text-[11px] px-2 py-0.5 rounded-full
                             bg-primary-50 text-primary-600">
              {gen.genre}
            </span>
          )}
          {gen.mood && (
            <span className="text-[11px] px-2 py-0.5 rounded-full
                             bg-accent-100 text-accent-500">
              {gen.mood}
            </span>
          )}
          <span className="flex items-center gap-1 text-[11px]
                           text-text-tertiary ml-auto">
            <Clock className="w-3 h-3" />
            {gen.actual_duration
              ? `${Math.round(gen.actual_duration)}s`
              : "--"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-tertiary">
            {formatDate(gen.created_at)}
          </span>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50
                       transition-colors cursor-pointer opacity-0
                       group-hover:opacity-100"
          >
            <Trash2 className="w-3.5 h-3.5 text-text-tertiary
                               hover:text-red-500" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

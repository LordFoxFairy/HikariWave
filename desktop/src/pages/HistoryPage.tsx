import { useEffect, useState } from "react";
import { Play, Trash2, Clock, Music } from "lucide-react";
import type { Generation } from "../types";
import { api } from "../services/api";
import { usePlayerStore } from "../stores/playerStore";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const play = usePlayerStore((s) => s.play);

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

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-1">
          History
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          Your generated tracks
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary-300
                            border-t-primary-600 rounded-full
                            animate-spin" />
          </div>
        ) : generations.length === 0 ? (
          <div className="text-center py-20">
            <Music className="w-12 h-12 text-text-tertiary
                              mx-auto mb-3" />
            <p className="text-text-secondary text-sm">
              No tracks yet. Create your first song!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {generations.map((gen) => (
              <div
                key={gen.id}
                className="bg-white rounded-xl border border-border
                           shadow-sm p-4 flex items-center gap-4
                           hover:shadow-md transition-shadow"
              >
                {/* Play button */}
                <button
                  onClick={() => play(gen)}
                  disabled={gen.status !== "completed"}
                  className="w-10 h-10 rounded-full flex-shrink-0
                             bg-primary-50 flex items-center
                             justify-center hover:bg-primary-100
                             transition-colors cursor-pointer
                             disabled:opacity-40
                             disabled:cursor-not-allowed"
                >
                  <Play className="w-4 h-4 text-primary-600
                                   ml-0.5" />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium
                                text-text-primary truncate">
                    {gen.prompt.slice(0, 60)}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    {gen.genre && (
                      <span className="text-xs px-2 py-0.5
                                       rounded-full bg-primary-50
                                       text-primary-600">
                        {gen.genre}
                      </span>
                    )}
                    <span className="flex items-center gap-1
                                     text-xs text-text-tertiary">
                      <Clock className="w-3 h-3" />
                      {gen.actual_duration
                        ? `${Math.round(gen.actual_duration)}s`
                        : "--"}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {formatDate(gen.created_at)}
                    </span>
                  </div>
                </div>

                {/* Status badge */}
                <span
                  className={`text-xs px-2.5 py-1 rounded-full
                    font-medium ${
                      gen.status === "completed"
                        ? "bg-green-50 text-green-600"
                        : gen.status === "failed"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                    }`}
                >
                  {gen.status}
                </span>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(gen.id)}
                  className="p-2 rounded-lg hover:bg-red-50
                             transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4
                                     text-text-tertiary
                                     hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

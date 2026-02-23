import { useState } from "react";
import {
  Sparkles,
  Music,
  Wand2,
  Loader2,
} from "lucide-react";
import { useCreateStore } from "../stores/createStore";
import { api } from "../services/api";

export default function CreatePage() {
  const {
    prompt,
    lyrics,
    selectedGenres,
    selectedMoods,
    genreOptions,
    moodOptions,
    generationStatus,
    progress,
    setPrompt,
    setLyrics,
    toggleGenre,
    toggleMood,
    setGenerationStatus,
    setCurrentTaskId,
    setProgress,
  } = useCreateStore();

  const [lyricsLoading, setLyricsLoading] = useState(false);

  const handleGenerateLyrics = async () => {
    if (!prompt.trim()) return;
    setLyricsLoading(true);
    try {
      const res = await api.generateLyrics({
        prompt: prompt.trim(),
        genre: selectedGenres[0],
        mood: selectedMoods[0],
      });
      setLyrics(res.lyrics);
    } catch {
      /* TODO: toast error */
    } finally {
      setLyricsLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerationStatus("pending");
    setProgress(0);
    try {
      const res = await api.generateMusic({
        prompt: prompt.trim(),
        lyrics: lyrics || undefined,
        genre: selectedGenres.join(", ") || undefined,
        mood: selectedMoods.join(", ") || undefined,
      });
      setCurrentTaskId(res.task_id);
      setGenerationStatus("processing");
      pollTask(res.task_id);
    } catch {
      setGenerationStatus("failed");
    }
  };

  const pollTask = async (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await api.getTaskStatus(taskId);
        setProgress(status.progress ?? 0);
        if (status.status === "completed") {
          setGenerationStatus("completed");
          clearInterval(interval);
        } else if (status.status === "failed") {
          setGenerationStatus("failed");
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
        setGenerationStatus("failed");
      }
    }, 2000);
  };

  const isGenerating =
    generationStatus === "pending" ||
    generationStatus === "processing";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-text-primary">
            Create Music
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Describe the music you want to create
          </p>
        </div>

        {/* Prompt input */}
        <div className="bg-white rounded-xl border border-border
                        shadow-sm p-5">
          <label className="text-sm font-medium text-text-primary
                            block mb-2">
            Description
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A dreamy lo-fi beat with soft piano and rain sounds..."
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-lg
                       border border-border bg-surface-secondary
                       text-sm text-text-primary
                       placeholder:text-text-tertiary
                       focus:outline-none focus:ring-2
                       focus:ring-primary-300 focus:border-primary-400
                       resize-none transition-all"
          />
        </div>

        {/* Genre tags */}
        <div className="bg-white rounded-xl border border-border
                        shadow-sm p-5">
          <label className="text-sm font-medium text-text-primary
                            block mb-3">
            Genre
          </label>
          <div className="flex flex-wrap gap-2">
            {genreOptions.map((genre) => (
              <button
                key={genre}
                onClick={() => toggleGenre(genre)}
                className={`px-3 py-1.5 rounded-full text-xs
                  font-medium transition-all cursor-pointer
                  ${
                    selectedGenres.includes(genre)
                      ? "bg-primary-100 text-primary-700 ring-1 ring-primary-300"
                      : "bg-surface-tertiary text-text-secondary hover:bg-surface-secondary"
                  }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Mood tags */}
        <div className="bg-white rounded-xl border border-border
                        shadow-sm p-5">
          <label className="text-sm font-medium text-text-primary
                            block mb-3">
            Mood
          </label>
          <div className="flex flex-wrap gap-2">
            {moodOptions.map((mood) => (
              <button
                key={mood}
                onClick={() => toggleMood(mood)}
                className={`px-3 py-1.5 rounded-full text-xs
                  font-medium transition-all cursor-pointer
                  ${
                    selectedMoods.includes(mood)
                      ? "bg-accent-100 text-accent-500 ring-1 ring-accent-300"
                      : "bg-surface-tertiary text-text-secondary hover:bg-surface-secondary"
                  }`}
              >
                {mood}
              </button>
            ))}
          </div>
        </div>

        {/* Lyrics */}
        <div className="bg-white rounded-xl border border-border
                        shadow-sm p-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-text-primary">
              Lyrics
            </label>
            <button
              onClick={handleGenerateLyrics}
              disabled={!prompt.trim() || lyricsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5
                         rounded-lg text-xs font-medium
                         bg-primary-50 text-primary-700
                         hover:bg-primary-100 transition-colors
                         disabled:opacity-40 cursor-pointer
                         disabled:cursor-not-allowed"
            >
              {lyricsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              Generate Lyrics
            </button>
          </div>
          <textarea
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            placeholder="[Verse 1]&#10;Your lyrics here..."
            rows={8}
            className="w-full px-3.5 py-2.5 rounded-lg
                       border border-border bg-surface-secondary
                       text-sm text-text-primary font-mono
                       placeholder:text-text-tertiary
                       focus:outline-none focus:ring-2
                       focus:ring-primary-300 focus:border-primary-400
                       resize-none transition-all"
          />
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isGenerating}
          className="w-full py-3.5 rounded-xl font-semibold
                     text-white text-sm
                     bg-gradient-to-r from-primary-600 to-primary-500
                     hover:from-primary-700 hover:to-primary-600
                     shadow-lg shadow-primary-200
                     disabled:opacity-50 disabled:cursor-not-allowed
                     transition-all cursor-pointer
                     flex items-center justify-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating... {Math.round(progress)}%
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Music
            </>
          )}
        </button>

        {/* Progress bar */}
        {isGenerating && (
          <div className="w-full h-1.5 bg-surface-tertiary
                          rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r
                         from-primary-500 to-accent-400
                         rounded-full transition-all
                         duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Status */}
        {generationStatus === "completed" && (
          <div className="flex items-center gap-2 px-4 py-3
                          bg-green-50 rounded-xl border
                          border-green-200">
            <Music className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">
              Music generated successfully!
            </span>
          </div>
        )}
        {generationStatus === "failed" && (
          <div className="flex items-center gap-2 px-4 py-3
                          bg-red-50 rounded-xl border border-red-200">
            <span className="text-sm text-red-700 font-medium">
              Generation failed. Please try again.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Music,
  Wand2,
  Loader2,
  ChevronRight,
  ChevronLeft,
  X,
  Zap,
  SlidersHorizontal,
  Eye,
  RotateCcw,
  Volume2,
  VolumeX,
  Globe,
  Clock,
  Gauge,
  KeyRound,
  Guitar,
} from "lucide-react";
import { useCreateStore } from "../stores/createStore";
import {
  GENRE_OPTIONS,
  MOOD_OPTIONS,
  INSTRUMENT_OPTIONS,
  KEY_OPTIONS,
  LANGUAGE_OPTIONS,
} from "../stores/createStore";
import { api } from "../services/api";
import type { CreateStep } from "../types";

/* ── Genre color map ── */
const genreColors: Record<string, string> = {
  Pop: "bg-pink-50 text-pink-700 ring-pink-200",
  Rock: "bg-red-50 text-red-700 ring-red-200",
  Jazz: "bg-amber-50 text-amber-700 ring-amber-200",
  Electronic: "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "Hip-Hop": "bg-violet-50 text-violet-700 ring-violet-200",
  "R&B": "bg-purple-50 text-purple-700 ring-purple-200",
  Classical: "bg-stone-50 text-stone-700 ring-stone-200",
  Country: "bg-orange-50 text-orange-700 ring-orange-200",
  Folk: "bg-lime-50 text-lime-700 ring-lime-200",
  "Lo-fi": "bg-teal-50 text-teal-700 ring-teal-200",
  Ambient: "bg-sky-50 text-sky-700 ring-sky-200",
  Latin: "bg-rose-50 text-rose-700 ring-rose-200",
  "K-Pop": "bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200",
  "J-Pop": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  Metal: "bg-zinc-100 text-zinc-700 ring-zinc-300",
  Blues: "bg-blue-50 text-blue-700 ring-blue-200",
  Reggae: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Soul: "bg-yellow-50 text-yellow-700 ring-yellow-200",
  Funk: "bg-orange-50 text-orange-700 ring-orange-200",
  Indie: "bg-slate-50 text-slate-700 ring-slate-200",
};

const moodGradients: Record<string, string> = {
  Happy: "from-yellow-100 to-amber-50 text-amber-700 ring-amber-200",
  Sad: "from-blue-100 to-indigo-50 text-indigo-700 ring-indigo-200",
  Energetic: "from-red-100 to-orange-50 text-orange-700 ring-orange-200",
  Calm: "from-sky-100 to-cyan-50 text-cyan-700 ring-cyan-200",
  Romantic: "from-pink-100 to-rose-50 text-rose-700 ring-rose-200",
  Dark: "from-gray-200 to-zinc-100 text-zinc-700 ring-zinc-300",
  Nostalgic: "from-amber-100 to-yellow-50 text-yellow-700 ring-yellow-200",
  Dreamy: "from-purple-100 to-violet-50 text-violet-700 ring-violet-200",
  Epic: "from-indigo-100 to-blue-50 text-blue-700 ring-blue-200",
  Chill: "from-teal-100 to-emerald-50 text-emerald-700 ring-emerald-200",
  Melancholy: "from-slate-100 to-gray-50 text-gray-700 ring-gray-200",
  Uplifting: "from-lime-100 to-green-50 text-green-700 ring-green-200",
};

const stepOrder: CreateStep[] = ["input", "config", "preview", "generating", "result"];
const stepLabels: Record<string, string> = {
  input: "Description",
  config: "Configure",
  preview: "Preview",
  generating: "Generating",
  result: "Result",
};

function tempoLabel(bpm: number): string {
  if (bpm < 80) return "Slow";
  if (bpm < 110) return "Medium";
  if (bpm < 140) return "Fast";
  return "Very Fast";
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/* ── Transition variants ── */
const pageVariants = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
};

/* ═══════════════════════════════════════
   Main Component
   ═══════════════════════════════════════ */
export default function CreatePage() {
  const store = useCreateStore();
  const [lyricsLoading, setLyricsLoading] = useState(false);

  /* ── AI helpers ── */
  const handleGenerateLyrics = useCallback(async () => {
    if (!store.prompt.trim()) return;
    setLyricsLoading(true);
    try {
      const res = await api.generateLyrics({
        prompt: store.prompt.trim(),
        genre: store.selectedGenres[0],
        mood: store.selectedMoods[0],
      });
      store.setLyrics(res.lyrics);
      if (res.suggestions) {
        store.applyAiSuggestions({
          genres: res.suggestions.genre ? [res.suggestions.genre] : undefined,
          tempo: res.suggestions.tempo ? parseInt(res.suggestions.tempo) || undefined : undefined,
          musicalKey: res.suggestions.key || undefined,
          instruments: res.suggestions.instruments,
        });
      }
    } catch { /* TODO: toast */ }
    finally { setLyricsLoading(false); }
  }, [store]);

  const handleAiSuggestField = useCallback(async (field: string) => {
    store.setAiSuggesting(field, true);
    try {
      const res = await api.generateLyrics({
        prompt: store.prompt.trim() || "suggest style",
        genre: store.selectedGenres[0],
        mood: store.selectedMoods[0],
      });
      if (res.suggestions) {
        if (field === "genre" && res.suggestions.genre) {
          store.applyAiSuggestions({ genres: [res.suggestions.genre] });
        } else if (field === "mood") {
          // use genre-based suggestion
        } else if (field === "tempo" && res.suggestions.tempo) {
          store.applyAiSuggestions({ tempo: parseInt(res.suggestions.tempo) || undefined });
        } else if (field === "key" && res.suggestions.key) {
          store.applyAiSuggestions({ musicalKey: res.suggestions.key });
        } else if (field === "instruments" && res.suggestions.instruments) {
          store.applyAiSuggestions({ instruments: res.suggestions.instruments });
        }
      }
    } catch { /* TODO: toast */ }
    finally { store.setAiSuggesting(field, false); }
  }, [store]);

  const handleSmartCreate = useCallback(async () => {
    if (!store.prompt.trim()) return;
    setLyricsLoading(true);
    try {
      const res = await api.generateLyrics({
        prompt: store.prompt.trim(),
        genre: undefined,
        mood: undefined,
      });
      store.setLyrics(res.lyrics);
      if (res.suggestions) {
        store.applyAiSuggestions({
          genres: res.suggestions.genre ? [res.suggestions.genre] : undefined,
          tempo: res.suggestions.tempo ? parseInt(res.suggestions.tempo) || undefined : undefined,
          musicalKey: res.suggestions.key || undefined,
          instruments: res.suggestions.instruments,
        });
      }
      store.setStep("preview");
    } catch { /* TODO: toast */ }
    finally { setLyricsLoading(false); }
  }, [store]);

  const pollTask = useCallback((taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await api.getTaskStatus(taskId);
        store.setProgress(status.progress ?? 0);
        if (status.status === "completed") {
          store.setGenerationStatus("completed");
          store.setStep("result");
          clearInterval(interval);
        } else if (status.status === "failed") {
          store.setGenerationStatus("failed");
          store.setStep("result");
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
        store.setGenerationStatus("failed");
        store.setStep("result");
      }
    }, 2000);
  }, [store]);

  const handleGenerate = useCallback(async () => {
    store.setGenerationStatus("pending");
    store.setProgress(0);
    store.setStep("generating");
    try {
      const res = await api.generateMusic({
        prompt: store.prompt.trim(),
        lyrics: store.lyrics || undefined,
        genre: store.selectedGenres.join(", ") || undefined,
        mood: store.selectedMoods.join(", ") || undefined,
        duration: store.duration,
      });
      store.setCurrentTaskId(res.task_id);
      store.setGenerationStatus("processing");
      pollTask(res.task_id);
    } catch {
      store.setGenerationStatus("failed");
      store.setStep("result");
    }
  }, [store, pollTask]);

  const handleCreateAnother = useCallback(() => {
    store.reset();
  }, [store]);

  const canProceedToConfig =
    store.mode === "custom"
      ? store.prompt.trim().length > 0 || store.lyrics.trim().length > 0
      : false;

  const canProceedToPreview =
    store.selectedGenres.length > 0 || store.selectedMoods.length > 0;

  /* ═══════════ RENDER ═══════════ */
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary flex items-center justify-center gap-2">
            <Music className="w-6 h-6 text-primary-500" />
            Create Music
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Describe your music and let AI bring it to life
          </p>
        </div>

        {/* ── Mode Toggle ── */}
        <div className="flex justify-center">
          <div className="inline-flex bg-white rounded-full p-1 border border-border shadow-sm">
            <button
              onClick={() => store.setMode("smart")}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer
                ${store.mode === "smart"
                  ? "bg-primary-600 text-white shadow-md"
                  : "text-text-secondary hover:text-text-primary"
                }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Smart Mode
            </button>
            <button
              onClick={() => store.setMode("custom")}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-medium transition-all cursor-pointer
                ${store.mode === "custom"
                  ? "bg-primary-600 text-white shadow-md"
                  : "text-text-secondary hover:text-text-primary"
                }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Custom Mode
            </button>
          </div>
        </div>

        {/* ── Step Progress ── */}
        <div className="flex items-center justify-center gap-1">
          {stepOrder.map((s, idx) => {
            const currentIdx = stepOrder.indexOf(store.step);
            const isActive = idx === currentIdx;
            const isDone = idx < currentIdx;
            return (
              <div key={s} className="flex items-center gap-1">
                <div
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all
                    ${isActive ? "bg-primary-100 text-primary-700" : ""}
                    ${isDone ? "bg-primary-50 text-primary-500" : ""}
                    ${!isActive && !isDone ? "text-text-tertiary" : ""}
                  `}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                    ${isActive ? "bg-primary-600 text-white" : ""}
                    ${isDone ? "bg-primary-400 text-white" : ""}
                    ${!isActive && !isDone ? "bg-surface-tertiary text-text-tertiary" : ""}
                  `}>
                    {isDone ? "✓" : idx + 1}
                  </span>
                  {stepLabels[s]}
                </div>
                {idx < stepOrder.length - 1 && (
                  <div className={`w-6 h-px ${idx < currentIdx ? "bg-primary-300" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Step Content ── */}
        <AnimatePresence mode="wait">
          {/* ════════ INPUT STEP ════════ */}
          {store.step === "input" && (
            <motion.div
              key="input"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Prompt */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                <label className="text-sm font-medium text-text-primary block mb-2">
                  Describe your music
                </label>
                <textarea
                  value={store.prompt}
                  onChange={(e) => store.setPrompt(e.target.value)}
                  placeholder="A dreamy lo-fi beat with soft piano and rain sounds..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border
                             bg-surface-secondary text-sm text-text-primary
                             placeholder:text-text-tertiary focus:outline-none
                             focus:ring-2 focus:ring-primary-300
                             focus:border-primary-400 resize-none transition-all"
                />
              </div>

              {/* Lyrics (shown in both modes at input step) */}
              {store.mode === "custom" && (
                <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-text-primary">
                      Lyrics
                    </label>
                    <button
                      onClick={handleGenerateLyrics}
                      disabled={!store.prompt.trim() || lyricsLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs
                                 font-medium bg-primary-50 text-primary-700
                                 hover:bg-primary-100 transition-colors
                                 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      {lyricsLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5" />
                      )}
                      AI Write Lyrics
                    </button>
                  </div>
                  <textarea
                    value={store.lyrics}
                    onChange={(e) => store.setLyrics(e.target.value)}
                    placeholder={"[Verse 1]\nYour lyrics here...\n\n[Chorus]\n..."}
                    rows={8}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-border
                               bg-surface-secondary text-sm text-text-primary font-mono
                               placeholder:text-text-tertiary focus:outline-none
                               focus:ring-2 focus:ring-primary-300
                               focus:border-primary-400 resize-none transition-all"
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex justify-end gap-3">
                {store.mode === "smart" ? (
                  <button
                    onClick={handleSmartCreate}
                    disabled={!store.prompt.trim() || lyricsLoading}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
                               text-white bg-gradient-to-r from-primary-600 to-primary-500
                               hover:from-primary-700 hover:to-primary-600
                               shadow-lg shadow-primary-200
                               disabled:opacity-50 disabled:cursor-not-allowed
                               transition-all cursor-pointer"
                  >
                    {lyricsLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {lyricsLoading ? "AI is creating..." : "Create with AI"}
                  </button>
                ) : (
                  <button
                    onClick={() => store.setStep("config")}
                    disabled={!canProceedToConfig}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
                               text-white bg-gradient-to-r from-primary-600 to-primary-500
                               hover:from-primary-700 hover:to-primary-600
                               shadow-lg shadow-primary-200
                               disabled:opacity-50 disabled:cursor-not-allowed
                               transition-all cursor-pointer"
                  >
                    Next: Configure
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* ════════ CONFIG STEP ════════ */}
          {store.step === "config" && (
            <motion.div
              key="config"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {/* Genre */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                    <Music className="w-4 h-4 text-primary-500" />
                    Genre
                  </label>
                  <AiSuggestBtn field="genre" loading={!!store.aiSuggesting["genre"]} onClick={handleAiSuggestField} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {GENRE_OPTIONS.map((genre) => {
                    const sel = store.selectedGenres.includes(genre);
                    const colors = genreColors[genre] || "bg-gray-50 text-gray-700 ring-gray-200";
                    return (
                      <button
                        key={genre}
                        onClick={() => store.toggleGenre(genre)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer
                          ${sel ? `${colors} ring-1` : "bg-surface-tertiary text-text-secondary hover:bg-surface-secondary"}`}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mood */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-accent-500" />
                    Mood
                  </label>
                  <AiSuggestBtn field="mood" loading={!!store.aiSuggesting["mood"]} onClick={handleAiSuggestField} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map((mood) => {
                    const sel = store.selectedMoods.includes(mood);
                    const grad = moodGradients[mood] || "from-gray-100 to-gray-50 text-gray-700 ring-gray-200";
                    return (
                      <button
                        key={mood}
                        onClick={() => store.toggleMood(mood)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer
                          ${sel ? `bg-gradient-to-r ${grad} ring-1` : "bg-surface-tertiary text-text-secondary hover:bg-surface-secondary"}`}
                      >
                        {mood}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Duration & Tempo */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-5">
                {/* Duration */}
                <div>
                  <label className="text-sm font-medium text-text-primary flex items-center gap-1.5 mb-2">
                    <Clock className="w-4 h-4 text-primary-500" />
                    Duration: {formatDuration(store.duration)}
                  </label>
                  <input
                    type="range"
                    min={30}
                    max={300}
                    step={10}
                    value={store.duration}
                    onChange={(e) => store.setDuration(Number(e.target.value))}
                    className="w-full accent-primary-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-text-tertiary mt-1">
                    <span>0:30</span><span>5:00</span>
                  </div>
                </div>

                {/* Tempo */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-primary-500" />
                      Tempo: {store.tempo} BPM
                      <span className="text-[10px] text-text-tertiary ml-1">({tempoLabel(store.tempo)})</span>
                    </label>
                    <AiSuggestBtn field="tempo" loading={!!store.aiSuggesting["tempo"]} onClick={handleAiSuggestField} />
                  </div>
                  <input
                    type="range"
                    min={60}
                    max={180}
                    step={1}
                    value={store.tempo}
                    onChange={(e) => store.setTempo(Number(e.target.value))}
                    className="w-full accent-primary-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-text-tertiary mt-1">
                    <span>60</span><span>120</span><span>180</span>
                  </div>
                </div>
              </div>

              {/* Key & Language & Instrumental */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Key */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                        <KeyRound className="w-4 h-4 text-primary-500" />
                        Key
                      </label>
                      <AiSuggestBtn field="key" loading={!!store.aiSuggesting["key"]} onClick={handleAiSuggestField} />
                    </div>
                    <select
                      value={store.musicalKey}
                      onChange={(e) => store.setMusicalKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary
                                 text-sm text-text-primary focus:outline-none focus:ring-2
                                 focus:ring-primary-300 cursor-pointer"
                    >
                      {KEY_OPTIONS.map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                  </div>

                  {/* Language */}
                  <div>
                    <label className="text-sm font-medium text-text-primary flex items-center gap-1.5 mb-2">
                      <Globe className="w-4 h-4 text-primary-500" />
                      Language
                    </label>
                    <select
                      value={store.language}
                      onChange={(e) => store.setLanguage(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-surface-secondary
                                 text-sm text-text-primary focus:outline-none focus:ring-2
                                 focus:ring-primary-300 cursor-pointer"
                    >
                      {LANGUAGE_OPTIONS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Instrumental Toggle */}
                <div className="flex items-center justify-between py-2">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                    {store.instrumental ? (
                      <VolumeX className="w-4 h-4 text-primary-500" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-primary-500" />
                    )}
                    Instrumental Only (no vocals)
                  </label>
                  <button
                    onClick={() => store.setInstrumental(!store.instrumental)}
                    className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer
                      ${store.instrumental ? "bg-primary-600" : "bg-surface-tertiary"}`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
                        ${store.instrumental ? "translate-x-5.5" : "translate-x-0.5"}`}
                    />
                  </button>
                </div>
              </div>

              {/* Instruments */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
                    <Guitar className="w-4 h-4 text-primary-500" />
                    Instruments
                  </label>
                  <AiSuggestBtn field="instruments" loading={!!store.aiSuggesting["instruments"]} onClick={handleAiSuggestField} />
                </div>
                <div className="flex flex-wrap gap-2">
                  {INSTRUMENT_OPTIONS.map((inst) => {
                    const sel = store.instruments.includes(inst);
                    return (
                      <button
                        key={inst}
                        onClick={() => store.toggleInstrument(inst)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer
                          ${sel
                            ? "bg-primary-100 text-primary-700 ring-1 ring-primary-300"
                            : "bg-surface-tertiary text-text-secondary hover:bg-surface-secondary"}`}
                      >
                        {inst}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nav buttons */}
              <div className="flex justify-between gap-3">
                <button
                  onClick={() => store.setStep("input")}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium
                             text-text-secondary bg-white border border-border
                             hover:bg-surface-secondary transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={() => store.setStep("preview")}
                  disabled={!canProceedToPreview}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold
                             text-white bg-gradient-to-r from-primary-600 to-primary-500
                             hover:from-primary-700 hover:to-primary-600
                             shadow-lg shadow-primary-200
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════ PREVIEW STEP ════════ */}
          {store.step === "preview" && (
            <motion.div
              key="preview"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              <div className="bg-white rounded-2xl border border-border shadow-md p-6
                              bg-gradient-to-br from-white via-primary-50/30 to-accent-50/20">
                <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary-500" />
                  Preview Summary
                </h3>

                {store.prompt && (
                  <div className="mb-4">
                    <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Description</span>
                    <p className="text-sm text-text-primary mt-1">{store.prompt}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-4">
                  {store.selectedGenres.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Genre</span>
                      <p className="text-sm text-text-primary mt-0.5">{store.selectedGenres.join(", ")}</p>
                    </div>
                  )}
                  {store.selectedMoods.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Mood</span>
                      <p className="text-sm text-text-primary mt-0.5">{store.selectedMoods.join(", ")}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Duration</span>
                    <p className="text-sm text-text-primary mt-0.5">{formatDuration(store.duration)}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Tempo</span>
                    <p className="text-sm text-text-primary mt-0.5">{store.tempo} BPM ({tempoLabel(store.tempo)})</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Key</span>
                    <p className="text-sm text-text-primary mt-0.5">{store.musicalKey}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Language</span>
                    <p className="text-sm text-text-primary mt-0.5">{store.language}</p>
                  </div>
                  {store.instruments.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Instruments</span>
                      <p className="text-sm text-text-primary mt-0.5">{store.instruments.join(", ")}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Vocals</span>
                    <p className="text-sm text-text-primary mt-0.5">{store.instrumental ? "Instrumental Only" : "With Vocals"}</p>
                  </div>
                </div>

                {/* Lyrics preview */}
                {store.lyrics && (
                  <div>
                    <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Lyrics</span>
                    <pre className="text-sm text-text-primary mt-1 font-mono whitespace-pre-wrap
                                    bg-surface-secondary rounded-lg p-3 max-h-48 overflow-y-auto">
                      {store.lyrics}
                    </pre>
                  </div>
                )}
              </div>

              {/* Nav buttons */}
              <div className="flex justify-between gap-3">
                <button
                  onClick={() => store.setStep(store.mode === "smart" ? "input" : "config")}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium
                             text-text-secondary bg-white border border-border
                             hover:bg-surface-secondary transition-all cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleGenerate}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold
                             text-white bg-gradient-to-r from-primary-600 to-accent-500
                             hover:from-primary-700 hover:to-accent-600
                             shadow-lg shadow-primary-200
                             transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Music
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════ GENERATING STEP ════════ */}
          {store.step === "generating" && (
            <motion.div
              key="generating"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-2xl border border-border shadow-md p-8 text-center">
                {/* Animated waveform visualization */}
                <div className="flex items-center justify-center gap-1 mb-6 h-16">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-primary-600 to-accent-400 rounded-full"
                      animate={{
                        height: [8, 24 + Math.random() * 32, 8],
                      }}
                      transition={{
                        duration: 0.8 + Math.random() * 0.5,
                        repeat: Infinity,
                        delay: i * 0.05,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  Creating your music...
                </h3>
                <p className="text-sm text-text-secondary mb-4">
                  AI is composing something special for you
                </p>

                {/* Progress bar */}
                <div className="w-full h-2 bg-surface-tertiary rounded-full overflow-hidden mb-2">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-500 to-accent-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${store.progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <p className="text-xs text-text-tertiary">
                  {Math.round(store.progress)}% complete
                </p>

                {/* Cancel button */}
                <button
                  onClick={() => {
                    store.setGenerationStatus("idle");
                    store.setStep("preview");
                  }}
                  className="mt-4 flex items-center gap-1.5 mx-auto px-4 py-2
                             rounded-lg text-xs font-medium text-text-secondary
                             hover:text-red-600 hover:bg-red-50
                             transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════ RESULT STEP ════════ */}
          {store.step === "result" && (
            <motion.div
              key="result"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.25 }}
              className="space-y-5"
            >
              {store.generationStatus === "completed" ? (
                <div className="bg-white rounded-2xl border border-border shadow-md p-6 text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Music className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">
                    Music Generated!
                  </h3>
                  <p className="text-sm text-text-secondary mb-6">
                    Your music has been created successfully.
                  </p>

                  {/* Lyrics display */}
                  {store.lyrics && (
                    <div className="text-left mb-6">
                      <span className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Lyrics</span>
                      <pre className="text-sm text-text-primary mt-1 font-mono whitespace-pre-wrap
                                      bg-surface-secondary rounded-lg p-3 max-h-48 overflow-y-auto">
                        {store.lyrics}
                      </pre>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={handleCreateAnother}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                                 text-primary-700 bg-primary-50 hover:bg-primary-100
                                 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Create Another
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-red-200 shadow-md p-6 text-center">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <X className="w-7 h-7 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">
                    Generation Failed
                  </h3>
                  <p className="text-sm text-text-secondary mb-6">
                    Something went wrong. Please try again.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => store.setStep("preview")}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                                 text-text-secondary bg-white border border-border
                                 hover:bg-surface-secondary transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back to Preview
                    </button>
                    <button
                      onClick={handleGenerate}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                                 text-white bg-primary-600 hover:bg-primary-700
                                 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Small helper component: AI Suggest Button ── */
function AiSuggestBtn({
  field,
  loading,
  onClick,
}: {
  field: string;
  loading: boolean;
  onClick: (field: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(field)}
      disabled={loading}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium
                 bg-primary-50 text-primary-600 hover:bg-primary-100
                 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Wand2 className="w-3 h-3" />
      )}
      AI Suggest
    </button>
  );
}

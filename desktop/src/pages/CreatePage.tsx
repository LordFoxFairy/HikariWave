import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Music,
  Wand2,
  Loader2,
  X,
  Zap,
  SlidersHorizontal,
  RotateCcw,
  Volume2,
  VolumeX,
  Globe,
  Clock,
  Gauge,
  KeyRound,
  Guitar,
  Type,
  AlertCircle,
  CheckCircle,
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

/* -- Genre color map -- */
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

/* -- Section animation -- */
const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export default function CreatePage() {
  const store = useCreateStore();
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [smartFilling, setSmartFilling] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const isGenerating = store.generationStatus === "pending" || store.generationStatus === "processing";
  const isCompleted = store.generationStatus === "completed";
  const isFailed = store.generationStatus === "failed";

  // Auto-dismiss messages
  useEffect(() => {
    if (store.errorMessage) {
      const t = setTimeout(() => store.setErrorMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [store.errorMessage, store]);

  useEffect(() => {
    if (store.successMessage) {
      const t = setTimeout(() => store.setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [store.successMessage, store]);

  /* -- AI: Suggest style via dedicated endpoint -- */
  const handleSuggestStyle = useCallback(async (field?: string) => {
    const fieldKey = field || "all";
    store.setAiSuggesting(fieldKey, true);
    try {
      const suggestion = await api.suggestStyle({
        prompt: store.prompt.trim() || "suggest style",
        genre: store.selectedGenres[0],
        mood: store.selectedMoods[0],
      });
      if (field === "genre" && suggestion.genres?.length) {
        store.applyAiSuggestions({ genres: suggestion.genres });
      } else if (field === "mood" && suggestion.moods?.length) {
        store.applyAiSuggestions({ moods: suggestion.moods });
      } else if (field === "tempo" && suggestion.tempo) {
        store.applyAiSuggestions({ tempo: suggestion.tempo });
      } else if (field === "key" && suggestion.musical_key) {
        store.applyAiSuggestions({ musicalKey: suggestion.musical_key });
      } else if (field === "instruments" && suggestion.instruments?.length) {
        store.applyAiSuggestions({ instruments: suggestion.instruments });
      } else {
        // Apply all suggestions
        store.applyAiSuggestions({
          genres: suggestion.genres?.length ? suggestion.genres : undefined,
          moods: suggestion.moods?.length ? suggestion.moods : undefined,
          tempo: suggestion.tempo || undefined,
          musicalKey: suggestion.musical_key || undefined,
          instruments: suggestion.instruments?.length ? suggestion.instruments : undefined,
          title: suggestion.title_suggestion || undefined,
        });
      }
    } catch {
      store.setErrorMessage("AI style suggestion failed. Check backend connection.");
    } finally {
      store.setAiSuggesting(fieldKey, false);
    }
  }, [store]);

  /* -- AI: Generate lyrics -- */
  const handleGenerateLyrics = useCallback(async () => {
    if (!store.prompt.trim()) return;
    setLyricsLoading(true);
    try {
      const res = await api.generateLyrics({
        prompt: store.prompt.trim(),
        genre: store.selectedGenres[0],
        mood: store.selectedMoods[0],
        language: store.language,
      });
      store.setLyrics(res.lyrics);
      if (res.suggestions) {
        store.applyAiSuggestions({
          genres: res.suggestions.genres?.length ? res.suggestions.genres : undefined,
          moods: res.suggestions.moods?.length ? res.suggestions.moods : undefined,
          tempo: res.suggestions.tempo || undefined,
          musicalKey: res.suggestions.musical_key || undefined,
          instruments: res.suggestions.instruments?.length ? res.suggestions.instruments : undefined,
          title: res.suggestions.title_suggestion || undefined,
        });
      }
      store.setSuccessMessage("Lyrics generated successfully");
    } catch {
      store.setErrorMessage("Failed to generate lyrics. Check backend connection.");
    } finally {
      setLyricsLoading(false);
    }
  }, [store]);

  /* -- AI: Generate title -- */
  const handleGenerateTitle = useCallback(async () => {
    store.setAiSuggesting("title", true);
    try {
      const res = await api.generateTitle({
        lyrics: store.lyrics || store.prompt,
        genre: store.selectedGenres[0],
        mood: store.selectedMoods[0],
      });
      store.setTitle(res.title);
    } catch {
      store.setErrorMessage("Failed to generate title.");
    } finally {
      store.setAiSuggesting("title", false);
    }
  }, [store]);

  /* -- Smart Mode: Fill all fields at once -- */
  const handleSmartFill = useCallback(async () => {
    if (!store.prompt.trim()) return;
    setSmartFilling(true);
    try {
      // 1. Suggest style
      const stylePromise = api.suggestStyle({
        prompt: store.prompt.trim(),
      }).catch(() => null);

      // 2. Generate lyrics
      const lyricsPromise = api.generateLyrics({
        prompt: store.prompt.trim(),
        language: store.language,
      }).catch(() => null);

      const [style, lyricsRes] = await Promise.all([stylePromise, lyricsPromise]);

      if (style) {
        store.applyAiSuggestions({
          genres: style.genres?.length ? style.genres : undefined,
          moods: style.moods?.length ? style.moods : undefined,
          tempo: style.tempo || undefined,
          musicalKey: style.musical_key || undefined,
          instruments: style.instruments?.length ? style.instruments : undefined,
          title: style.title_suggestion || undefined,
        });
      }

      if (lyricsRes) {
        store.setLyrics(lyricsRes.lyrics);
        // Also apply any suggestions from lyrics response
        if (lyricsRes.suggestions) {
          store.applyAiSuggestions({
            genres: !style && lyricsRes.suggestions.genres?.length ? lyricsRes.suggestions.genres : undefined,
            moods: !style && lyricsRes.suggestions.moods?.length ? lyricsRes.suggestions.moods : undefined,
            tempo: !style && lyricsRes.suggestions.tempo ? lyricsRes.suggestions.tempo : undefined,
            musicalKey: !style && lyricsRes.suggestions.musical_key ? lyricsRes.suggestions.musical_key : undefined,
            instruments: !style && lyricsRes.suggestions.instruments?.length ? lyricsRes.suggestions.instruments : undefined,
          });
        }
      }

      // 3. Generate title if we have lyrics and no title yet
      if (lyricsRes?.lyrics && !style?.title_suggestion) {
        try {
          const titleRes = await api.generateTitle({
            lyrics: lyricsRes.lyrics,
            genre: style?.genres?.[0],
            mood: style?.moods?.[0],
          });
          store.setTitle(titleRes.title);
        } catch {
          // Title generation is optional, non-blocking
        }
      }

      store.setSuccessMessage("AI filled all fields! Review and generate.");
    } catch {
      store.setErrorMessage("Smart fill failed. Check backend connection.");
    } finally {
      setSmartFilling(false);
    }
  }, [store]);

  /* -- Task polling -- */
  const pollTask = useCallback((taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const gen = await api.getTaskStatus(taskId);
        store.setProgress(gen.progress ?? 0);
        if (gen.status === "completed") {
          store.setGenerationStatus("completed");
          store.setSuccessMessage("Music generated successfully!");
          clearInterval(interval);
          setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
        } else if (gen.status === "failed") {
          store.setGenerationStatus("failed");
          store.setErrorMessage(gen.error_message || "Generation failed.");
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
        store.setGenerationStatus("failed");
        store.setErrorMessage("Lost connection during generation.");
      }
    }, 2000);
  }, [store]);

  /* -- Generate music -- */
  const handleGenerate = useCallback(async () => {
    if (!store.prompt.trim()) {
      store.setErrorMessage("Please enter a description first.");
      return;
    }
    store.setGenerationStatus("pending");
    store.setProgress(0);
    store.setErrorMessage(null);
    try {
      const res = await api.generateMusic({
        prompt: store.prompt.trim(),
        lyrics: store.lyrics || undefined,
        genre: store.selectedGenres.join(", ") || undefined,
        mood: store.selectedMoods.join(", ") || undefined,
        duration: store.duration,
        title: store.title || undefined,
        tempo: store.tempo,
        musical_key: store.musicalKey,
        instruments: store.instruments.length > 0 ? store.instruments : undefined,
        language: store.language,
        instrumental: store.instrumental,
      });
      store.setCurrentTaskId(res.task_id);
      store.setGenerationStatus("processing");
      pollTask(res.task_id);
    } catch (err) {
      store.setGenerationStatus("failed");
      store.setErrorMessage(err instanceof Error ? err.message : "Failed to start generation.");
    }
  }, [store, pollTask]);

  const handleCreateAnother = useCallback(() => {
    store.reset();
  }, [store]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* -- Header -- */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text-primary flex items-center justify-center gap-2">
            <Music className="w-6 h-6 text-primary-500" />
            Create Music
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Describe your music and let AI bring it to life
          </p>
        </div>

        {/* -- Toast messages -- */}
        <AnimatePresence>
          {store.errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{store.errorMessage}</span>
              <button onClick={() => store.setErrorMessage(null)} className="cursor-pointer p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
          {store.successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700"
            >
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{store.successMessage}</span>
              <button onClick={() => store.setSuccessMessage(null)} className="cursor-pointer p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -- Mode Toggle -- */}
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

        {/* ================================================================
            SECTION: Prompt
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.05 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
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

          {/* Smart Mode: "Generate All" button */}
          {store.mode === "smart" && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={handleSmartFill}
                disabled={!store.prompt.trim() || smartFilling}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                           text-white bg-gradient-to-r from-primary-600 to-primary-500
                           hover:from-primary-700 hover:to-primary-600
                           shadow-lg shadow-primary-200
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all cursor-pointer"
              >
                {smartFilling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {smartFilling ? "AI is filling..." : "Auto-Fill with AI"}
              </button>
            </div>
          )}
        </motion.div>

        {/* ================================================================
            SECTION: Title
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.08 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
              <Type className="w-4 h-4 text-primary-500" />
              Song Title
            </label>
            <AiSuggestBtn
              field="title"
              loading={!!store.aiSuggesting["title"]}
              onClick={() => handleGenerateTitle()}
            />
          </div>
          <input
            type="text"
            value={store.title}
            onChange={(e) => store.setTitle(e.target.value)}
            placeholder="Enter a title or let AI suggest one..."
            className="w-full px-3.5 py-2.5 rounded-lg border border-border
                       bg-surface-secondary text-sm text-text-primary
                       placeholder:text-text-tertiary focus:outline-none
                       focus:ring-2 focus:ring-primary-300
                       focus:border-primary-400 transition-all"
          />
        </motion.div>

        {/* ================================================================
            SECTION: Lyrics
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.11 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
              <Music className="w-4 h-4 text-primary-500" />
              Lyrics
            </label>
            <div className="flex items-center gap-2">
              {/* Instrumental toggle inline */}
              <button
                onClick={() => store.setInstrumental(!store.instrumental)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium
                           transition-colors cursor-pointer
                           ${store.instrumental
                             ? "bg-primary-100 text-primary-700"
                             : "bg-surface-tertiary text-text-secondary hover:bg-surface-secondary"}`}
              >
                {store.instrumental ? (
                  <VolumeX className="w-3 h-3" />
                ) : (
                  <Volume2 className="w-3 h-3" />
                )}
                {store.instrumental ? "Instrumental" : "With Vocals"}
              </button>
              <AiSuggestBtn
                field="lyrics"
                loading={lyricsLoading}
                onClick={() => handleGenerateLyrics()}
              />
            </div>
          </div>

          {store.instrumental ? (
            <div className="flex items-center justify-center py-6 text-sm text-text-tertiary bg-surface-secondary rounded-lg">
              <VolumeX className="w-4 h-4 mr-2" />
              Instrumental mode -- no lyrics needed
            </div>
          ) : (
            <>
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
              <div className="flex items-center gap-2 mt-2">
                <Globe className="w-3.5 h-3.5 text-text-tertiary" />
                <select
                  value={store.language}
                  onChange={(e) => store.setLanguage(e.target.value)}
                  className="px-2 py-1 rounded-lg border border-border bg-surface-secondary
                             text-xs text-text-primary focus:outline-none focus:ring-2
                             focus:ring-primary-300 cursor-pointer"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </motion.div>

        {/* ================================================================
            SECTION: Genre
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.14 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
              <Music className="w-4 h-4 text-primary-500" />
              Genre
            </label>
            <AiSuggestBtn field="genre" loading={!!store.aiSuggesting["genre"]} onClick={() => handleSuggestStyle("genre")} />
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
        </motion.div>

        {/* ================================================================
            SECTION: Mood
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.17 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-accent-500" />
              Mood
            </label>
            <AiSuggestBtn field="mood" loading={!!store.aiSuggesting["mood"]} onClick={() => handleSuggestStyle("mood")} />
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
        </motion.div>

        {/* ================================================================
            SECTION: Duration & Tempo
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-5"
        >
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
              <AiSuggestBtn field="tempo" loading={!!store.aiSuggesting["tempo"]} onClick={() => handleSuggestStyle("tempo")} />
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
        </motion.div>

        {/* ================================================================
            SECTION: Key & Language
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.23 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-primary-500" />
              Musical Key
            </label>
            <AiSuggestBtn field="key" loading={!!store.aiSuggesting["key"]} onClick={() => handleSuggestStyle("key")} />
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
        </motion.div>

        {/* ================================================================
            SECTION: Instruments
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.26 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-text-primary flex items-center gap-1.5">
              <Guitar className="w-4 h-4 text-primary-500" />
              Instruments
            </label>
            <AiSuggestBtn field="instruments" loading={!!store.aiSuggesting["instruments"]} onClick={() => handleSuggestStyle("instruments")} />
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
        </motion.div>

        {/* ================================================================
            SECTION: Generate Button
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.29 }}
          className="pt-2"
        >
          <button
            onClick={handleGenerate}
            disabled={!store.prompt.trim() || isGenerating}
            className="w-full flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-bold
                       text-white bg-gradient-to-r from-primary-600 to-accent-500
                       hover:from-primary-700 hover:to-accent-600
                       shadow-lg shadow-primary-200
                       disabled:opacity-50 disabled:cursor-not-allowed
                       transition-all cursor-pointer"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            {isGenerating ? "Generating..." : "Generate Music"}
          </button>
        </motion.div>

        {/* ================================================================
            SECTION: Generation Progress (shown when generating)
           ================================================================ */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
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
        </AnimatePresence>

        {/* ================================================================
            SECTION: Result (shown after generation completes)
           ================================================================ */}
        <AnimatePresence>
          {(isCompleted || isFailed) && (
            <motion.div
              ref={resultRef}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
            >
              {isCompleted ? (
                <div className="bg-white rounded-2xl border border-border shadow-md p-6 text-center">
                  <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Music className="w-7 h-7 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">
                    Music Generated!
                  </h3>
                  <p className="text-sm text-text-secondary mb-6">
                    Your music has been created successfully. Check the History tab to listen.
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
                      onClick={() => store.setGenerationStatus("idle")}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                                 text-text-secondary bg-white border border-border
                                 hover:bg-surface-secondary transition-colors cursor-pointer"
                    >
                      Dismiss
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

        {/* Bottom spacer */}
        <div className="h-4" />
      </div>
    </div>
  );
}

/* -- Small helper component: AI Suggest Button -- */
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

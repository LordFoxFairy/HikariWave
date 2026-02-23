import { useState, useCallback, useRef, useEffect, useMemo } from "react";
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
  Mic,
  Plus,
  Repeat,
  Shuffle,
  Image,
  GitBranch,
} from "lucide-react";
import type { Generation, ExtendRequest, RemixRequest } from "../types";
import { useCreateStore } from "../stores/createStore";
import {
  GENRE_OPTIONS,
  MOOD_OPTIONS,
  INSTRUMENT_OPTIONS,
  KEY_OPTIONS,
  LANGUAGE_OPTIONS,
} from "../stores/createStore";
import { api } from "../services/api";

/* -- Song structure tags for the lyrics toolbar -- */
const STRUCTURE_TAGS = [
  "Intro",
  "Verse",
  "Pre-Chorus",
  "Chorus",
  "Bridge",
  "Outro",
  "Instrumental Break",
];

/* -- Genre color map -- */
const genreColors: Record<string, string> = {
  Pop: "bg-pink-50 text-pink-700 border-pink-200",
  Rock: "bg-red-50 text-red-700 border-red-200",
  Jazz: "bg-amber-50 text-amber-700 border-amber-200",
  Electronic: "bg-cyan-50 text-cyan-700 border-cyan-200",
  "Hip-Hop": "bg-violet-50 text-violet-700 border-violet-200",
  "R&B": "bg-purple-50 text-purple-700 border-purple-200",
  Classical: "bg-stone-50 text-stone-700 border-stone-200",
  Country: "bg-orange-50 text-orange-700 border-orange-200",
  Folk: "bg-lime-50 text-lime-700 border-lime-200",
  "Lo-fi": "bg-teal-50 text-teal-700 border-teal-200",
  Ambient: "bg-sky-50 text-sky-700 border-sky-200",
  Latin: "bg-rose-50 text-rose-700 border-rose-200",
  "K-Pop": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
  "J-Pop": "bg-indigo-50 text-indigo-700 border-indigo-200",
  Metal: "bg-zinc-100 text-zinc-700 border-zinc-300",
  Blues: "bg-blue-50 text-blue-700 border-blue-200",
  Reggae: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Soul: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Funk: "bg-orange-50 text-orange-700 border-orange-200",
  Indie: "bg-slate-50 text-slate-700 border-slate-200",
};

const moodGradients: Record<string, string> = {
  Happy: "from-yellow-100 to-amber-50 text-amber-700 border-amber-200",
  Sad: "from-blue-100 to-indigo-50 text-indigo-700 border-indigo-200",
  Energetic: "from-red-100 to-orange-50 text-orange-700 border-orange-200",
  Calm: "from-sky-100 to-cyan-50 text-cyan-700 border-cyan-200",
  Romantic: "from-pink-100 to-rose-50 text-rose-700 border-rose-200",
  Dark: "from-gray-200 to-zinc-100 text-zinc-700 border-zinc-300",
  Nostalgic: "from-amber-100 to-yellow-50 text-yellow-700 border-yellow-200",
  Dreamy: "from-purple-100 to-violet-50 text-violet-700 border-violet-200",
  Epic: "from-indigo-100 to-blue-50 text-blue-700 border-blue-200",
  Chill: "from-teal-100 to-emerald-50 text-emerald-700 border-emerald-200",
  Melancholy: "from-slate-100 to-gray-50 text-gray-700 border-gray-200",
  Uplifting: "from-lime-100 to-green-50 text-green-700 border-green-200",
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

/* Pre-computed random values for waveform animation to avoid jitter on re-render */
const WAVEFORM_RANDOMS = Array.from({ length: 24 }, () => ({
  height: 20 + Math.random() * 36,
  duration: 0.8 + Math.random() * 0.5,
}));

/* -- Section animation -- */
const sectionVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export default function CreatePage() {
  const store = useCreateStore();
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [smartFilling, setSmartFilling] = useState(false);
  const [completedGen, setCompletedGen] = useState<Generation | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const lyricsRef = useRef<HTMLTextAreaElement>(null);

  // Extend/Remix inline form state
  const [showExtendForm, setShowExtendForm] = useState(false);
  const [showRemixForm, setShowRemixForm] = useState(false);
  const [extendPrompt, setExtendPrompt] = useState("");
  const [extendLyrics, setExtendLyrics] = useState("");
  const [extendDuration, setExtendDuration] = useState(30);
  const [remixGenre, setRemixGenre] = useState("");
  const [remixMood, setRemixMood] = useState("");
  const [remixTempo, setRemixTempo] = useState<number | undefined>(undefined);
  const [remixKey, setRemixKey] = useState("");
  const [remixPrompt, setRemixPrompt] = useState("");
  const [coverRegenerating, setCoverRegenerating] = useState(false);
  const [extendRemixLoading, setExtendRemixLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState("");

  const isGenerating = store.generationStatus === "pending" || store.generationStatus === "processing";
  const isCompleted = store.generationStatus === "completed";
  const isFailed = store.generationStatus === "failed";

  // Fetch completed generation data for cover art display
  useEffect(() => {
    if (isCompleted && store.currentTaskId) {
      api.getTaskStatus(store.currentTaskId).then(setCompletedGen).catch(() => {});
    } else if (!isCompleted) {
      setCompletedGen(null);
    }
  }, [isCompleted, store.currentTaskId]);

  const completedCoverUrl = useMemo(() => {
    if (completedGen?.cover_art_path) {
      return api.getCoverArtUrl(completedGen.cover_art_path);
    }
    return null;
  }, [completedGen]);

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

  /* -- Insert structure tag at cursor in lyrics editor -- */
  const insertStructureTag = useCallback((tag: string) => {
    const el = lyricsRef.current;
    const insertion = `[${tag}]\n`;
    if (el) {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;
      const prefix = start > 0 && val[start - 1] !== "\n" ? "\n" : "";
      const newVal = val.slice(0, start) + prefix + insertion + val.slice(end);
      store.setLyrics(newVal);
      requestAnimationFrame(() => {
        const pos = start + prefix.length + insertion.length;
        el.selectionStart = pos;
        el.selectionEnd = pos;
        el.focus();
      });
    } else {
      const current = store.lyrics;
      const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
      store.setLyrics(current + prefix + insertion);
    }
  }, [store]);

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
      const stylePromise = api.suggestStyle({
        prompt: store.prompt.trim(),
      }).catch(() => null);

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

      if (lyricsRes?.lyrics && !style?.title_suggestion) {
        try {
          const titleRes = await api.generateTitle({
            lyrics: lyricsRes.lyrics,
            genre: style?.genres?.[0],
            mood: style?.moods?.[0],
          });
          store.setTitle(titleRes.title);
        } catch {
          // Title generation is optional
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
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  const pollTask = useCallback((taskId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const interval = setInterval(async () => {
      try {
        const gen = await api.getTaskStatus(taskId);
        store.setProgress(gen.progress ?? 0);
        setProgressMessage(gen.progress_message || "");
        if (gen.status === "completed") {
          store.setGenerationStatus("completed");
          store.setSuccessMessage("Music generated successfully!");
          setProgressMessage("");
          clearInterval(interval);
          pollIntervalRef.current = null;
          setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
        } else if (gen.status === "failed") {
          store.setGenerationStatus("failed");
          store.setErrorMessage(gen.error_message || "Generation failed.");
          setProgressMessage("");
          clearInterval(interval);
          pollIntervalRef.current = null;
        }
      } catch {
        clearInterval(interval);
        pollIntervalRef.current = null;
        store.setGenerationStatus("failed");
        store.setErrorMessage("Lost connection during generation.");
        setProgressMessage("");
      }
    }, 2000);
    pollIntervalRef.current = interval;
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
    setShowExtendForm(false);
    setShowRemixForm(false);
    setCompletedGen(null);
  }, [store]);

  /* -- Extend song -- */
  const handleExtend = useCallback(async () => {
    if (!completedGen) return;
    setExtendRemixLoading(true);
    try {
      const data: ExtendRequest = {
        generation_id: completedGen.id,
        prompt: extendPrompt || undefined,
        lyrics: extendLyrics || undefined,
        duration: extendDuration,
      };
      const res = await api.extendSong(data);
      store.setCurrentTaskId(res.task_id);
      store.setGenerationStatus("processing");
      store.setProgress(0);
      setShowExtendForm(false);
      pollTask(res.task_id);
    } catch (err) {
      store.setErrorMessage(err instanceof Error ? err.message : "Failed to extend song.");
    } finally {
      setExtendRemixLoading(false);
    }
  }, [completedGen, extendPrompt, extendLyrics, extendDuration, store, pollTask]);

  /* -- Remix song -- */
  const handleRemix = useCallback(async () => {
    if (!completedGen) return;
    setExtendRemixLoading(true);
    try {
      const data: RemixRequest = {
        generation_id: completedGen.id,
        genre: remixGenre || undefined,
        mood: remixMood || undefined,
        tempo: remixTempo,
        musical_key: remixKey || undefined,
        prompt: remixPrompt || undefined,
      };
      const res = await api.remixSong(data);
      store.setCurrentTaskId(res.task_id);
      store.setGenerationStatus("processing");
      store.setProgress(0);
      setShowRemixForm(false);
      pollTask(res.task_id);
    } catch (err) {
      store.setErrorMessage(err instanceof Error ? err.message : "Failed to remix song.");
    } finally {
      setExtendRemixLoading(false);
    }
  }, [completedGen, remixGenre, remixMood, remixTempo, remixKey, remixPrompt, store, pollTask]);

  /* -- Regenerate cover art -- */
  const handleRegenerateCover = useCallback(async () => {
    if (!completedGen) return;
    setCoverRegenerating(true);
    try {
      const res = await api.regenerateCover({
        generation_id: completedGen.id,
        title: completedGen.title || undefined,
        genre: completedGen.genre || undefined,
        mood: completedGen.mood || undefined,
        lyrics: completedGen.lyrics || undefined,
      });
      setCompletedGen({ ...completedGen, cover_art_path: res.cover_art_path });
      store.setSuccessMessage("Cover art regenerated!");
    } catch (err) {
      store.setErrorMessage(err instanceof Error ? err.message : "Failed to regenerate cover.");
    } finally {
      setCoverRegenerating(false);
    }
  }, [completedGen, store]);

  /* -- Open remix form with pre-filled values -- */
  const openRemixForm = useCallback(() => {
    if (completedGen) {
      setRemixGenre(completedGen.genre || "");
      setRemixMood(completedGen.mood || "");
      setRemixTempo(completedGen.tempo || undefined);
      setRemixKey(completedGen.musical_key || "");
      setRemixPrompt("");
    }
    setShowRemixForm(true);
    setShowExtendForm(false);
  }, [completedGen]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[640px] mx-auto px-6 py-10 space-y-6">

        {/* -- Header -- */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-2"
        >
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
            Create Music
          </h1>
          <p className="text-[13px] text-text-tertiary mt-1">
            Describe your song, customize the style, and let AI compose it
          </p>
        </motion.div>

        {/* -- Toast messages (fixed top-right) -- */}
        <div className="fixed top-12 right-4 z-50 space-y-2 pointer-events-none">
          <AnimatePresence>
            {store.errorMessage && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white border border-red-200
                           text-sm text-red-700 shadow-lg pointer-events-auto max-w-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span className="flex-1 leading-snug">{store.errorMessage}</span>
                <button onClick={() => store.setErrorMessage(null)} className="cursor-pointer p-0.5 hover:bg-red-50 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
            {store.successMessage && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white border border-green-200
                           text-sm text-green-700 shadow-lg pointer-events-auto max-w-sm"
              >
                <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-500" />
                <span className="flex-1 leading-snug">{store.successMessage}</span>
                <button onClick={() => store.setSuccessMessage(null)} className="cursor-pointer p-0.5 hover:bg-green-50 rounded">
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* -- Mode Toggle -- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex justify-center"
        >
          <div className="inline-flex bg-white rounded-full p-1 border border-border shadow-sm">
            <button
              onClick={() => store.setMode("smart")}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer
                ${store.mode === "smart"
                  ? "bg-primary-600 text-white shadow-md"
                  : "text-text-secondary hover:text-text-primary"
                }`}
            >
              <Zap className="w-3.5 h-3.5" />
              Simple
            </button>
            <button
              onClick={() => store.setMode("custom")}
              className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer
                ${store.mode === "custom"
                  ? "bg-primary-600 text-white shadow-md"
                  : "text-text-secondary hover:text-text-primary"
                }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Custom
            </button>
          </div>
        </motion.div>

        {/* ================================================================
            SECTION: Prompt -- the main creative input
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.05, duration: 0.35 }}
          className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
        >
          <div className="p-5 pb-4">
            <label className="text-[13px] font-semibold text-text-primary block mb-2.5">
              Song Description
            </label>
            <textarea
              value={store.prompt}
              onChange={(e) => store.setPrompt(e.target.value)}
              placeholder="e.g. A dreamy lo-fi beat with soft piano and rain sounds, perfect for late-night studying..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-border
                         bg-surface-secondary text-sm text-text-primary leading-relaxed
                         placeholder:text-text-tertiary/60 focus:outline-none
                         focus:ring-2 focus:ring-primary-200
                         focus:border-primary-300 resize-none transition-all"
            />
          </div>

          {/* Smart Mode: prominent "Auto-Fill" CTA */}
          {store.mode === "smart" && (
            <div className="px-5 pb-5">
              <button
                onClick={handleSmartFill}
                disabled={!store.prompt.trim() || smartFilling}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold
                           text-white bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500
                           hover:from-primary-700 hover:via-primary-600 hover:to-accent-600
                           shadow-md shadow-primary-200/50
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-all cursor-pointer"
              >
                {smartFilling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {smartFilling ? "AI is composing..." : "Auto-Fill with AI"}
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
          transition={{ delay: 0.08, duration: 0.35 }}
          className="bg-white rounded-2xl border border-border shadow-sm p-5"
        >
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
              <Type className="w-4 h-4 text-primary-500" />
              Title
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
            placeholder="Give your song a name..."
            className="w-full px-4 py-2.5 rounded-xl border border-border
                       bg-surface-secondary text-sm text-text-primary
                       placeholder:text-text-tertiary/60 focus:outline-none
                       focus:ring-2 focus:ring-primary-200
                       focus:border-primary-300 transition-all"
          />
        </motion.div>

        {/* ================================================================
            SECTION: Lyrics (with structure tag toolbar)
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.11, duration: 0.35 }}
          className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-5 pt-5 pb-0">
            <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
              <Mic className="w-4 h-4 text-primary-500" />
              Lyrics
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => store.setInstrumental(!store.instrumental)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium
                           transition-all cursor-pointer border
                           ${store.instrumental
                             ? "bg-primary-50 text-primary-700 border-primary-200"
                             : "bg-white text-text-secondary border-border hover:border-primary-200 hover:text-text-primary"}`}
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
            <div className="m-5 flex items-center justify-center py-8 text-sm text-text-tertiary
                            bg-surface-secondary rounded-xl border border-dashed border-border">
              <VolumeX className="w-4 h-4 mr-2 opacity-50" />
              Instrumental mode -- no lyrics needed
            </div>
          ) : (
            <div className="p-5 pt-3 space-y-3">
              {/* Structure tag toolbar */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mr-1">
                  Insert:
                </span>
                {STRUCTURE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => insertStructureTag(tag)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium
                               text-primary-600 bg-primary-50 hover:bg-primary-100
                               border border-primary-100 hover:border-primary-200
                               transition-all cursor-pointer"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    {tag}
                  </button>
                ))}
              </div>

              {/* Lyrics textarea */}
              <textarea
                ref={lyricsRef}
                value={store.lyrics}
                onChange={(e) => store.setLyrics(e.target.value)}
                placeholder={"[Verse]\nWrite your lyrics here, or let AI generate them...\n\n[Chorus]\nThe heart of your song..."}
                rows={10}
                className="w-full px-4 py-3 rounded-xl border border-border
                           bg-surface-secondary text-[13px] text-text-primary
                           leading-relaxed font-mono
                           placeholder:text-text-tertiary/50 focus:outline-none
                           focus:ring-2 focus:ring-primary-200
                           focus:border-primary-300 resize-none transition-all"
              />

              {/* Language selector */}
              <div className="flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-text-tertiary" />
                <select
                  value={store.language}
                  onChange={(e) => store.setLanguage(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-border bg-white
                             text-xs text-text-primary focus:outline-none focus:ring-2
                             focus:ring-primary-200 cursor-pointer"
                >
                  {LANGUAGE_OPTIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </motion.div>

        {/* ================================================================
            SECTION: Style -- Genre & Mood combined (Suno-like)
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.14, duration: 0.35 }}
          className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-5"
        >
          {/* Genre */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                <Music className="w-4 h-4 text-primary-500" />
                Genre
              </label>
              <AiSuggestBtn field="genre" loading={!!store.aiSuggesting["genre"]} onClick={() => handleSuggestStyle("genre")} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_OPTIONS.map((genre) => {
                const sel = store.selectedGenres.includes(genre);
                const colors = genreColors[genre] || "bg-gray-50 text-gray-700 border-gray-200";
                return (
                  <button
                    key={genre}
                    onClick={() => store.toggleGenre(genre)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer border
                      ${sel
                        ? `${colors} shadow-sm`
                        : "bg-white text-text-secondary border-border hover:border-primary-200 hover:text-text-primary"
                      }`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border-light" />

          {/* Mood */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-accent-500" />
                Mood
              </label>
              <AiSuggestBtn field="mood" loading={!!store.aiSuggesting["mood"]} onClick={() => handleSuggestStyle("mood")} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MOOD_OPTIONS.map((mood) => {
                const sel = store.selectedMoods.includes(mood);
                const grad = moodGradients[mood] || "from-gray-100 to-gray-50 text-gray-700 border-gray-200";
                return (
                  <button
                    key={mood}
                    onClick={() => store.toggleMood(mood)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer border
                      ${sel
                        ? `bg-gradient-to-r ${grad} shadow-sm`
                        : "bg-white text-text-secondary border-border hover:border-primary-200 hover:text-text-primary"
                      }`}
                  >
                    {mood}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* ================================================================
            SECTION: Sound -- Duration, Tempo, Key, Instruments combined
            Only shown in "custom" mode for a simpler default experience
           ================================================================ */}
        {store.mode === "custom" && (
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.17, duration: 0.35 }}
          className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-5"
        >
          {/* Duration & Tempo side by side */}
          <div className="grid grid-cols-2 gap-5">
            {/* Duration */}
            <div>
              <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5 mb-3">
                <Clock className="w-4 h-4 text-primary-500" />
                Duration
              </label>
              <div className="bg-surface-secondary rounded-xl p-3 border border-border-light">
                <div className="text-center mb-2">
                  <span className="text-lg font-bold text-text-primary tabular-nums">
                    {formatDuration(store.duration)}
                  </span>
                </div>
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
            </div>

            {/* Tempo */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-primary-500" />
                  Tempo
                </label>
                <AiSuggestBtn field="tempo" loading={!!store.aiSuggesting["tempo"]} onClick={() => handleSuggestStyle("tempo")} />
              </div>
              <div className="bg-surface-secondary rounded-xl p-3 border border-border-light">
                <div className="text-center mb-2">
                  <span className="text-lg font-bold text-text-primary tabular-nums">
                    {store.tempo}
                  </span>
                  <span className="text-[11px] text-text-tertiary ml-1">
                    BPM ({tempoLabel(store.tempo)})
                  </span>
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
          </div>

          {/* Divider */}
          <div className="border-t border-border-light" />

          {/* Key */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-primary-500" />
                Musical Key
              </label>
              <AiSuggestBtn field="key" loading={!!store.aiSuggesting["key"]} onClick={() => handleSuggestStyle("key")} />
            </div>
            <select
              value={store.musicalKey}
              onChange={(e) => store.setMusicalKey(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-surface-secondary
                         text-sm text-text-primary focus:outline-none focus:ring-2
                         focus:ring-primary-200 cursor-pointer"
            >
              {KEY_OPTIONS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Divider */}
          <div className="border-t border-border-light" />

          {/* Instruments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                <Guitar className="w-4 h-4 text-primary-500" />
                Instruments
              </label>
              <AiSuggestBtn field="instruments" loading={!!store.aiSuggesting["instruments"]} onClick={() => handleSuggestStyle("instruments")} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {INSTRUMENT_OPTIONS.map((inst) => {
                const sel = store.instruments.includes(inst);
                return (
                  <button
                    key={inst}
                    onClick={() => store.toggleInstrument(inst)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer border
                      ${sel
                        ? "bg-primary-50 text-primary-700 border-primary-200 shadow-sm"
                        : "bg-white text-text-secondary border-border hover:border-primary-200 hover:text-text-primary"
                      }`}
                  >
                    {inst}
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>
        )}

        {/* ================================================================
            SECTION: Generate Button
           ================================================================ */}
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.2, duration: 0.35 }}
          className="pt-1 pb-2"
        >
          <button
            onClick={handleGenerate}
            disabled={!store.prompt.trim() || isGenerating}
            className="w-full flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-[15px] font-bold
                       text-white bg-gradient-to-r from-primary-600 via-primary-500 to-accent-500
                       hover:from-primary-700 hover:via-primary-600 hover:to-accent-600
                       shadow-lg shadow-primary-200/60
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none
                       transition-all cursor-pointer active:scale-[0.98]"
          >
            {isGenerating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            {isGenerating ? "Generating..." : "Create Song"}
          </button>
        </motion.div>

        {/* ================================================================
            SECTION: Generation Progress
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
                {/* Animated waveform */}
                <div className="flex items-center justify-center gap-[3px] mb-6 h-16">
                  {WAVEFORM_RANDOMS.map((rand, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-gradient-to-t from-primary-600 to-accent-400 rounded-full"
                      animate={{
                        height: [6, rand.height, 6],
                      }}
                      transition={{
                        duration: rand.duration,
                        repeat: Infinity,
                        delay: i * 0.04,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </div>

                <h3 className="text-lg font-semibold text-text-primary mb-1.5">
                  Creating your song...
                </h3>
                <p className="text-sm text-text-tertiary mb-5">
                  {progressMessage || "AI is composing something special for you"}
                </p>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden mb-2">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-500 to-accent-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${store.progress}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <p className="text-xs text-text-tertiary tabular-nums">
                  {Math.round(store.progress)}%
                </p>

                <button
                  onClick={() => store.setGenerationStatus("idle")}
                  className="mt-5 flex items-center gap-1.5 mx-auto px-4 py-2
                             rounded-lg text-xs font-medium text-text-tertiary
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
            SECTION: Result
           ================================================================ */}
        <AnimatePresence>
          {(isCompleted || isFailed) && (
            <motion.div
              ref={resultRef}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
            >
              {isCompleted ? (
                <div className="bg-white rounded-2xl border border-border shadow-md p-6 space-y-5">
                  {/* Cover art with regenerate overlay */}
                  <div className="text-center">
                    {completedCoverUrl ? (
                      <div className="relative w-36 h-36 rounded-2xl overflow-hidden mx-auto mb-5 shadow-lg
                                      ring-4 ring-primary-100 group/cover">
                        <img
                          src={completedCoverUrl}
                          alt="Cover art"
                          className={`w-full h-full object-cover transition-opacity ${coverRegenerating ? "opacity-40" : ""}`}
                        />
                        {coverRegenerating && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
                          </div>
                        )}
                        <button
                          onClick={handleRegenerateCover}
                          disabled={coverRegenerating}
                          className="absolute inset-0 flex items-center justify-center bg-black/0
                                     group-hover/cover:bg-black/30 transition-all cursor-pointer
                                     opacity-0 group-hover/cover:opacity-100"
                        >
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                          bg-white/90 text-[11px] font-medium text-text-primary shadow-sm">
                            <Image className="w-3 h-3" />
                            Regenerate
                          </div>
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5
                                      border border-green-200">
                        <Music className="w-7 h-7 text-green-600" />
                      </div>
                    )}
                    <h3 className="text-lg font-bold text-text-primary mb-1">
                      Song Created!
                    </h3>

                    {/* Lineage info */}
                    {completedGen?.parent_id && completedGen?.parent_type && (
                      <p className="text-[12px] text-text-tertiary flex items-center justify-center gap-1.5 mb-1">
                        <GitBranch className="w-3 h-3" />
                        {completedGen.parent_type === "extend" ? "Extended from" : "Remix of"} #{completedGen.parent_id}
                      </p>
                    )}

                    <p className="text-sm text-text-tertiary">
                      Head to History to listen and download your track
                    </p>
                  </div>

                  {store.lyrics && (
                    <div className="text-left">
                      <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                        Lyrics
                      </span>
                      <pre className="text-[13px] text-text-primary mt-2 font-mono whitespace-pre-wrap leading-relaxed
                                      bg-surface-secondary rounded-xl p-4 max-h-52 overflow-y-auto border border-border-light">
                        {store.lyrics}
                      </pre>
                    </div>
                  )}

                  {/* Action buttons: Extend, Remix, Regenerate Cover, Create Another */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      onClick={() => { setShowExtendForm(!showExtendForm); setShowRemixForm(false); }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium
                                 transition-all cursor-pointer border
                                 ${showExtendForm
                                   ? "bg-primary-50 text-primary-700 border-primary-200"
                                   : "text-text-secondary bg-white border-border hover:border-primary-200 hover:text-text-primary"}`}
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      Extend
                    </button>
                    <button
                      onClick={openRemixForm}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium
                                 transition-all cursor-pointer border
                                 ${showRemixForm
                                   ? "bg-accent-50 text-accent-500 border-accent-200"
                                   : "text-text-secondary bg-white border-border hover:border-accent-200 hover:text-text-primary"}`}
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      Remix
                    </button>
                    <button
                      onClick={handleRegenerateCover}
                      disabled={coverRegenerating}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium
                                 text-text-secondary bg-white border border-border hover:border-primary-200
                                 hover:text-text-primary transition-all cursor-pointer
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {coverRegenerating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Image className="w-3.5 h-3.5" />
                      )}
                      Regen Cover
                    </button>
                    <button
                      onClick={handleCreateAnother}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium
                                 text-primary-700 bg-primary-50 hover:bg-primary-100
                                 border border-primary-200
                                 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Create Another
                    </button>
                  </div>

                  {/* Extend inline form */}
                  <AnimatePresence>
                    {showExtendForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-surface-secondary rounded-xl border border-border-light p-4 space-y-3">
                          <h4 className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                            <Repeat className="w-3.5 h-3.5 text-primary-500" />
                            Extend Song
                          </h4>
                          <input
                            type="text"
                            value={extendPrompt}
                            onChange={(e) => setExtendPrompt(e.target.value)}
                            placeholder="Optional: describe how to continue..."
                            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm
                                       placeholder:text-text-tertiary/60 focus:outline-none focus:ring-2
                                       focus:ring-primary-200"
                          />
                          <textarea
                            value={extendLyrics}
                            onChange={(e) => setExtendLyrics(e.target.value)}
                            placeholder="Optional: additional lyrics..."
                            rows={3}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm
                                       font-mono placeholder:text-text-tertiary/60 focus:outline-none
                                       focus:ring-2 focus:ring-primary-200 resize-none"
                          />
                          <div className="flex items-center gap-3">
                            <label className="text-[12px] text-text-secondary">Duration:</label>
                            <input
                              type="range"
                              min={10}
                              max={120}
                              step={5}
                              value={extendDuration}
                              onChange={(e) => setExtendDuration(Number(e.target.value))}
                              className="flex-1 accent-primary-600"
                            />
                            <span className="text-[12px] text-text-primary tabular-nums w-10 text-right">
                              {extendDuration}s
                            </span>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setShowExtendForm(false)}
                              className="px-3 py-1.5 rounded-lg text-[12px] text-text-secondary hover:bg-white
                                         border border-border transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleExtend}
                              disabled={extendRemixLoading}
                              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium
                                         text-white bg-primary-600 hover:bg-primary-700 transition-colors cursor-pointer
                                         disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {extendRemixLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Repeat className="w-3 h-3" />}
                              Extend
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Remix inline form */}
                  <AnimatePresence>
                    {showRemixForm && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-surface-secondary rounded-xl border border-border-light p-4 space-y-3">
                          <h4 className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                            <Shuffle className="w-3.5 h-3.5 text-accent-500" />
                            Remix Song
                          </h4>
                          <input
                            type="text"
                            value={remixPrompt}
                            onChange={(e) => setRemixPrompt(e.target.value)}
                            placeholder="Optional: describe remix direction..."
                            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm
                                       placeholder:text-text-tertiary/60 focus:outline-none focus:ring-2
                                       focus:ring-primary-200"
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] text-text-tertiary mb-1 block">Genre</label>
                              <input
                                type="text"
                                value={remixGenre}
                                onChange={(e) => setRemixGenre(e.target.value)}
                                placeholder="e.g. Electronic"
                                className="w-full px-3 py-1.5 rounded-lg border border-border bg-white text-[12px]
                                           focus:outline-none focus:ring-2 focus:ring-primary-200"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-text-tertiary mb-1 block">Mood</label>
                              <input
                                type="text"
                                value={remixMood}
                                onChange={(e) => setRemixMood(e.target.value)}
                                placeholder="e.g. Energetic"
                                className="w-full px-3 py-1.5 rounded-lg border border-border bg-white text-[12px]
                                           focus:outline-none focus:ring-2 focus:ring-primary-200"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-text-tertiary mb-1 block">Tempo (BPM)</label>
                              <input
                                type="number"
                                value={remixTempo ?? ""}
                                onChange={(e) => setRemixTempo(e.target.value ? Number(e.target.value) : undefined)}
                                placeholder="120"
                                className="w-full px-3 py-1.5 rounded-lg border border-border bg-white text-[12px]
                                           focus:outline-none focus:ring-2 focus:ring-primary-200"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-text-tertiary mb-1 block">Key</label>
                              <input
                                type="text"
                                value={remixKey}
                                onChange={(e) => setRemixKey(e.target.value)}
                                placeholder="e.g. C Minor"
                                className="w-full px-3 py-1.5 rounded-lg border border-border bg-white text-[12px]
                                           focus:outline-none focus:ring-2 focus:ring-primary-200"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setShowRemixForm(false)}
                              className="px-3 py-1.5 rounded-lg text-[12px] text-text-secondary hover:bg-white
                                         border border-border transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleRemix}
                              disabled={extendRemixLoading}
                              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium
                                         text-white bg-gradient-to-r from-primary-600 to-accent-500
                                         hover:from-primary-700 hover:to-accent-600 transition-all cursor-pointer
                                         disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {extendRemixLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shuffle className="w-3 h-3" />}
                              Remix
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-red-200 shadow-md p-6 text-center">
                  <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4
                                  border border-red-200">
                    <X className="w-7 h-7 text-red-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-1">
                    Generation Failed
                  </h3>
                  <p className="text-sm text-text-tertiary mb-6">
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

        {/* Bottom spacer for player clearance */}
        <div className="h-20" />
      </div>
    </div>
  );
}

/* -- Small helper: AI Suggest Button -- */
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
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                 text-primary-600 hover:bg-primary-50
                 transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed
                 border border-transparent hover:border-primary-200"
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Wand2 className="w-3 h-3" />
      )}
      AI
    </button>
  );
}

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {
    AlertCircle,
    CheckCircle,
    Clock,
    Gauge,
    Globe,
    Guitar,
    KeyRound,
    Layers,
    Loader2,
    Mic,
    Music,
    Plus,
    SlidersHorizontal,
    Sparkles,
    Type,
    Volume2,
    VolumeX,
    Wand2,
    X,
    Zap,
} from "lucide-react";
import type {ExtendRequest, Generation, PipelineInfo, RemixRequest} from "../types";
import {
    GENRE_OPTIONS,
    INSTRUMENT_OPTIONS,
    KEY_OPTIONS,
    LANGUAGE_OPTIONS,
    MOOD_OPTIONS,
    useCreateStore
} from "../stores/createStore";
import {usePlayerStore} from "../stores/playerStore";
import {api} from "../services/api";
import {useTranslation} from "react-i18next";

import {
    formatDuration,
    genreColors,
    moodGradients,
    sectionVariants,
    STRUCTURE_TAGS,
    tempoLabelKey,
} from "../constants/musicOptions";
import {CustomSelect} from "../components/CustomSelect";
import {useTaskPolling} from "../hooks/useTaskPolling";
import {GenerationProgress} from "../components/create/GenerationProgress";
import {GenerationResult} from "../components/create/GenerationResult";
import {ExtendRemixForms} from "../components/create/ExtendRemixForms";
import {TagSelector} from "../components/create/TagSelector";

export default function CreatePage() {
    const store = useCreateStore();
    const playerStore = usePlayerStore();
    const {t} = useTranslation();
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
    const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);

    const {pollTask, cancelPolling, progressMessage} = useTaskPolling({resultRef});

    const isGenerating = store.generationStatus === "pending" || store.generationStatus === "processing";

    // Check if the currently playing track is the completed generation
    const isPlayingThis =
        playerStore.isPlaying &&
        completedGen != null &&
        playerStore.currentTrack?.id === completedGen.id;

    const handlePlayPause = useCallback(() => {
        if (!completedGen) return;
        if (isPlayingThis) {
            playerStore.setIsPlaying(false);
        } else if (playerStore.currentTrack?.id === completedGen.id) {
            playerStore.setIsPlaying(true);
        } else {
            playerStore.setQueue([completedGen], 0);
        }
    }, [completedGen, isPlayingThis, playerStore]);

    // Fetch completed generation data for cover art display
    useEffect(() => {
        if (store.generationStatus === "completed" && store.currentTaskId) {
            api.getTaskStatus(store.currentTaskId).then(setCompletedGen).catch(() => {
            });
        } else if (store.generationStatus !== "completed") {
            setCompletedGen(null);
        }
    }, [store.generationStatus, store.currentTaskId]);

    const completedCoverUrl = useMemo(() => {
        if (completedGen?.cover_art_path) {
            return api.getCoverArtUrl(completedGen.cover_art_path);
        }
        return null;
    }, [completedGen]);

    // Auto-dismiss messages
    useEffect(() => {
        if (store.errorMessage) {
            const timer = setTimeout(() => store.setErrorMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [store.errorMessage, store]);

    useEffect(() => {
        if (store.successMessage) {
            const timer = setTimeout(() => store.setSuccessMessage(null), 4000);
            return () => clearTimeout(timer);
        }
    }, [store.successMessage, store]);

    // Fetch available pipelines
    useEffect(() => {
        api.listPipelines()
            .then(res => setPipelines(res.pipelines))
            .catch(() => {});
    }, []);

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
                store.applyAiSuggestions({genres: suggestion.genres});
            } else if (field === "mood" && suggestion.moods?.length) {
                store.applyAiSuggestions({moods: suggestion.moods});
            } else if (field === "tempo" && suggestion.tempo) {
                store.applyAiSuggestions({tempo: suggestion.tempo});
            } else if (field === "key" && suggestion.musical_key) {
                store.applyAiSuggestions({musicalKey: suggestion.musical_key});
            } else if (field === "instruments" && suggestion.instruments?.length) {
                store.applyAiSuggestions({instruments: suggestion.instruments});
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
            store.setErrorMessage(t("create.aiStyleFailed"));
        } finally {
            store.setAiSuggesting(fieldKey, false);
        }
    }, [store, t]);

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
            store.setSuccessMessage(t("create.lyricsGeneratedSuccess"));
        } catch {
            store.setErrorMessage(t("create.lyricsGenerateFailed"));
        } finally {
            setLyricsLoading(false);
        }
    }, [store, t]);

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
            store.setErrorMessage(t("create.titleGenerateFailed"));
        } finally {
            store.setAiSuggesting("title", false);
        }
    }, [store, t]);

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

            store.setSuccessMessage(t("create.aiFillSuccess"));
        } catch {
            store.setErrorMessage(t("create.smartFillFailed"));
        } finally {
            setSmartFilling(false);
        }
    }, [store, t]);

    /* -- Generate music -- */
    const handleGenerate = useCallback(async () => {
        if (!store.prompt.trim()) {
            store.setErrorMessage(t("create.pleaseEnterDescription"));
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
                pipeline: store.pipeline || undefined,
            });
            store.setCurrentTaskId(res.task_id);
            store.setGenerationStatus("processing");
            pollTask(res.task_id);
        } catch (err) {
            store.setGenerationStatus("failed");
            store.setErrorMessage(err instanceof Error ? err.message : t("create.generationFailed"));
        }
    }, [store, pollTask, t]);

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
            store.setErrorMessage(err instanceof Error ? err.message : t("create.extendFailed"));
        } finally {
            setExtendRemixLoading(false);
        }
    }, [completedGen, extendPrompt, extendLyrics, extendDuration, store, pollTask, t]);

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
            store.setErrorMessage(err instanceof Error ? err.message : t("create.remixFailed"));
        } finally {
            setExtendRemixLoading(false);
        }
    }, [completedGen, remixGenre, remixMood, remixTempo, remixKey, remixPrompt, store, pollTask, t]);

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
            setCompletedGen({...completedGen, cover_art_path: res.cover_art_path});
            store.setSuccessMessage(t("create.coverRegenerated"));
        } catch (err) {
            store.setErrorMessage(err instanceof Error ? err.message : t("create.coverRegenFailed"));
        } finally {
            setCoverRegenerating(false);
        }
    }, [completedGen, store, t]);

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
                    initial={{opacity: 0, y: -8}}
                    animate={{opacity: 1, y: 0}}
                    className="text-center mb-2"
                >
                    <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
                        {t("create.title")}
                    </h1>
                    <p className="text-[13px] text-text-tertiary mt-1">
                        {t("create.subtitle")}
                    </p>
                </motion.div>

                {/* -- Toast messages (fixed top-right) -- */}
                <div className="fixed top-12 right-4 z-50 space-y-2 pointer-events-none">
                    <AnimatePresence>
                        {store.errorMessage && (
                            <motion.div
                                initial={{opacity: 0, x: 20}}
                                animate={{opacity: 1, x: 0}}
                                exit={{opacity: 0, x: 20}}
                                className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white border border-red-200
                           text-sm text-red-700 shadow-lg pointer-events-auto max-w-sm"
                            >
                                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500"/>
                                <span className="flex-1 leading-snug">{store.errorMessage}</span>
                                <button onClick={() => store.setErrorMessage(null)}
                                        className="cursor-pointer p-0.5 hover:bg-red-50 rounded">
                                    <X className="w-3.5 h-3.5"/>
                                </button>
                            </motion.div>
                        )}
                        {store.successMessage && (
                            <motion.div
                                initial={{opacity: 0, x: 20}}
                                animate={{opacity: 1, x: 0}}
                                exit={{opacity: 0, x: 20}}
                                className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white border border-green-200
                           text-sm text-green-700 shadow-lg pointer-events-auto max-w-sm"
                            >
                                <CheckCircle className="w-4 h-4 flex-shrink-0 text-green-500"/>
                                <span className="flex-1 leading-snug">{store.successMessage}</span>
                                <button onClick={() => store.setSuccessMessage(null)}
                                        className="cursor-pointer p-0.5 hover:bg-green-50 rounded">
                                    <X className="w-3.5 h-3.5"/>
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* -- Mode Toggle -- */}
                <motion.div
                    initial={{opacity: 0, scale: 0.96}}
                    animate={{opacity: 1, scale: 1}}
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
                            <Zap className="w-3.5 h-3.5"/>
                            {t("create.simple")}
                        </button>
                        <button
                            onClick={() => store.setMode("custom")}
                            className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-[13px] font-medium transition-all cursor-pointer
                ${store.mode === "custom"
                                ? "bg-primary-600 text-white shadow-md"
                                : "text-text-secondary hover:text-text-primary"
                            }`}
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5"/>
                            {t("create.custom")}
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
                    transition={{delay: 0.05, duration: 0.35}}
                    className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
                >
                    <div className="p-5 pb-4">
                        <label className="text-[13px] font-semibold text-text-primary block mb-2.5">
                            {t("create.songDescription")}
                        </label>
                        <textarea
                            value={store.prompt}
                            onChange={(e) => store.setPrompt(e.target.value)}
                            placeholder={t("create.placeholder")}
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
                                    <Loader2 className="w-4 h-4 animate-spin"/>
                                ) : (
                                    <Sparkles className="w-4 h-4"/>
                                )}
                                {smartFilling ? t("create.aiComposing") : t("create.autoFill")}
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
                    transition={{delay: 0.08, duration: 0.35}}
                    className="bg-white rounded-2xl border border-border shadow-sm p-5"
                >
                    <div className="flex items-center justify-between mb-2.5">
                        <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                            <Type className="w-4 h-4 text-primary-500"/>
                            {t("create.titleLabel")}
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
                        placeholder={t("create.titlePlaceholder")}
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
                    transition={{delay: 0.11, duration: 0.35}}
                    className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
                >
                    {/* Header row */}
                    <div className="flex items-center justify-between px-5 pt-5 pb-0">
                        <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                            <Mic className="w-4 h-4 text-primary-500"/>
                            {t("create.lyrics")}
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
                                    <VolumeX className="w-3 h-3"/>
                                ) : (
                                    <Volume2 className="w-3 h-3"/>
                                )}
                                {store.instrumental ? t("create.instrumental") : t("create.withVocals")}
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
                            <VolumeX className="w-4 h-4 mr-2 opacity-50"/>
                            {t("create.instrumentalHint")}
                        </div>
                    ) : (
                        <div className="p-5 pt-3 space-y-3">
                            {/* Structure tag toolbar */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mr-1">
                  {t("create.insert")}
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
                                        <Plus className="w-2.5 h-2.5"/>
                                        {t(`structureTags.${tag}`, tag)}
                                    </button>
                                ))}
                            </div>

                            {/* Lyrics textarea */}
                            <textarea
                                ref={lyricsRef}
                                value={store.lyrics}
                                onChange={(e) => store.setLyrics(e.target.value)}
                                placeholder={t("create.lyricsPlaceholder")}
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
                                <Globe className="w-3.5 h-3.5 text-text-tertiary"/>
                                <CustomSelect
                                    value={store.language}
                                    onChange={(v) => store.setLanguage(v)}
                                    options={LANGUAGE_OPTIONS}
                                    labelFn={(opt) => t(`tags.languages.${opt}`, opt)}
                                    compact
                                />
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* ================================================================
            SECTION: Style -- Genre & Mood combined
           ================================================================ */}
                <motion.div
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{delay: 0.14, duration: 0.35}}
                    className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-5"
                >
                    {/* Genre */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                                <Music className="w-4 h-4 text-primary-500"/>
                                {t("create.genre")}
                            </label>
                            <AiSuggestBtn field="genre" loading={!!store.aiSuggesting["genre"]}
                                          onClick={() => handleSuggestStyle("genre")}/>
                        </div>
                        <TagSelector
                            presets={GENRE_OPTIONS}
                            selected={store.selectedGenres}
                            onToggle={store.toggleGenre}
                            colorFn={(tag, sel) => sel ? `${genreColors[tag] || "bg-gray-50 text-gray-700 border-gray-200"} shadow-sm` : ""}
                            labelFn={(tag) => t(`tags.genres.${tag}`, tag)}
                            placeholder={t("create.addGenre", "Add genre...")}
                        />
                    </div>

                    {/* Divider */}
                    <div className="border-t border-border-light"/>

                    {/* Mood */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                                <Sparkles className="w-4 h-4 text-accent-500"/>
                                {t("create.mood")}
                            </label>
                            <AiSuggestBtn field="mood" loading={!!store.aiSuggesting["mood"]}
                                          onClick={() => handleSuggestStyle("mood")}/>
                        </div>
                        <TagSelector
                            presets={MOOD_OPTIONS}
                            selected={store.selectedMoods}
                            onToggle={store.toggleMood}
                            colorFn={(tag, sel) => sel ? `bg-gradient-to-r ${moodGradients[tag] || "from-gray-100 to-gray-50 text-gray-700 border-gray-200"} shadow-sm` : ""}
                            labelFn={(tag) => t(`tags.moods.${tag}`, tag)}
                            placeholder={t("create.addMood", "Add mood...")}
                        />
                    </div>
                </motion.div>

                {/* ================================================================
            SECTION: Sound -- Duration, Tempo, Key, Instruments combined
            Only shown in "custom" mode
           ================================================================ */}
                {store.mode === "custom" && (
                    <motion.div
                        variants={sectionVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{delay: 0.17, duration: 0.35}}
                        className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-5"
                    >
                        {/* Duration & Tempo side by side */}
                        <div className="grid grid-cols-2 gap-5">
                            {/* Duration */}
                            <div>
                                <label
                                    className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5 mb-3">
                                    <Clock className="w-4 h-4 text-primary-500"/>
                                    {t("create.duration")}
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
                                        max={600}
                                        step={5}
                                        value={store.duration}
                                        onChange={(e) => store.setDuration(Number(e.target.value))}
                                        className="w-full accent-primary-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] text-text-tertiary mt-1">
                                        <span>0:30</span><span>10:00</span>
                                    </div>
                                </div>
                            </div>

                            {/* Tempo */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label
                                        className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                                        <Gauge className="w-4 h-4 text-primary-500"/>
                                        {t("create.tempo")}
                                    </label>
                                    <AiSuggestBtn field="tempo" loading={!!store.aiSuggesting["tempo"]}
                                                  onClick={() => handleSuggestStyle("tempo")}/>
                                </div>
                                <div className="bg-surface-secondary rounded-xl p-3 border border-border-light">
                                    <div className="text-center mb-2">
                  <span className="text-lg font-bold text-text-primary tabular-nums">
                    {store.tempo}
                  </span>
                                        <span className="text-[11px] text-text-tertiary ml-1">
                    {t("create.bpm")} ({t(tempoLabelKey(store.tempo))})
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
                        <div className="border-t border-border-light"/>

                        {/* Key */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <label
                                    className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                                    <KeyRound className="w-4 h-4 text-primary-500"/>
                                    {t("create.musicalKey")}
                                </label>
                                <AiSuggestBtn field="key" loading={!!store.aiSuggesting["key"]}
                                              onClick={() => handleSuggestStyle("key")}/>
                            </div>
                            <CustomSelect
                                value={store.musicalKey}
                                onChange={(v) => store.setMusicalKey(v)}
                                options={KEY_OPTIONS}
                            />
                        </div>

                        {/* Divider */}
                        <div className="border-t border-border-light"/>

                        {/* Instruments */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label
                                    className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                                    <Guitar className="w-4 h-4 text-primary-500"/>
                                    {t("create.instruments")}
                                </label>
                                <AiSuggestBtn field="instruments" loading={!!store.aiSuggesting["instruments"]}
                                              onClick={() => handleSuggestStyle("instruments")}/>
                            </div>
                            <TagSelector
                                presets={INSTRUMENT_OPTIONS}
                                selected={store.instruments}
                                onToggle={store.toggleInstrument}
                                labelFn={(tag) => t(`tags.instruments.${tag}`, tag)}
                                placeholder={t("create.addInstrument", "Add instrument...")}
                            />
                        </div>
                    </motion.div>
                )}

                {/* ================================================================
            SECTION: Pipeline Selector (custom mode, multiple pipelines)
           ================================================================ */}
                {store.mode === "custom" && pipelines.length > 1 && (
                    <motion.div
                        variants={sectionVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{delay: 0.19, duration: 0.35}}
                        className="bg-white rounded-2xl border border-border shadow-sm p-5"
                    >
                        <div className="flex items-center justify-between mb-2.5">
                            <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                                <Layers className="w-4 h-4 text-primary-500"/>
                                {t("create.pipeline")}
                            </label>
                            <span className="text-[11px] text-text-tertiary">
                                {t("create.pipelineHint")}
                            </span>
                        </div>
                        <CustomSelect
                            value={store.pipeline}
                            onChange={(v) => store.setPipeline(v)}
                            options={["", ...pipelines.map(p => p.name)]}
                            labelFn={(opt) => {
                                if (opt === "") return t("create.pipelineAuto");
                                const PIPELINE_I18N: Record<string, string> = {
                                    direct: "create.pipelineDirect",
                                    vocal_instrumental: "create.pipelineVocalInstrumental",
                                };
                                const i18nKey = PIPELINE_I18N[opt];
                                if (i18nKey) return t(i18nKey);
                                const info = pipelines.find(p => p.name === opt);
                                return info ? info.description || info.name : opt;
                            }}
                            placeholder={t("create.pipelineAuto")}
                        />
                    </motion.div>
                )}

                {/* ================================================================
            SECTION: Generate Button
           ================================================================ */}
                <motion.div
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{delay: 0.2, duration: 0.35}}
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
                            <Loader2 className="w-5 h-5 animate-spin"/>
                        ) : (
                            <Sparkles className="w-5 h-5"/>
                        )}
                        {isGenerating ? t("create.generating") : t("create.createSong")}
                    </button>
                </motion.div>

                {/* ================================================================
            SECTION: Generation Progress
           ================================================================ */}
                <GenerationProgress
                    progressMessage={progressMessage}
                    onCancel={cancelPolling}
                />

                {/* ================================================================
            SECTION: Result
           ================================================================ */}
                <GenerationResult
                    ref={resultRef}
                    completedGen={completedGen}
                    completedCoverUrl={completedCoverUrl}
                    coverRegenerating={coverRegenerating}
                    isPlayingThis={isPlayingThis}
                    showExtendForm={showExtendForm}
                    showRemixForm={showRemixForm}
                    onPlayPause={handlePlayPause}
                    onRegenerateCover={handleRegenerateCover}
                    onCreateAnother={handleCreateAnother}
                    onToggleExtendForm={() => {
                        setShowExtendForm(!showExtendForm);
                        setShowRemixForm(false);
                    }}
                    onOpenRemixForm={openRemixForm}
                    onRetryGenerate={handleGenerate}
                    extendRemixNode={
                        <ExtendRemixForms
                            showExtendForm={showExtendForm}
                            showRemixForm={showRemixForm}
                            extendForm={{prompt: extendPrompt, lyrics: extendLyrics, duration: extendDuration}}
                            remixForm={{
                                prompt: remixPrompt,
                                genre: remixGenre,
                                mood: remixMood,
                                tempo: remixTempo,
                                musicalKey: remixKey
                            }}
                            loading={extendRemixLoading}
                            onExtendFormChange={(u) => {
                                if (u.prompt !== undefined) setExtendPrompt(u.prompt);
                                if (u.lyrics !== undefined) setExtendLyrics(u.lyrics);
                                if (u.duration !== undefined) setExtendDuration(u.duration);
                            }}
                            onRemixFormChange={(u) => {
                                if (u.prompt !== undefined) setRemixPrompt(u.prompt);
                                if (u.genre !== undefined) setRemixGenre(u.genre);
                                if (u.mood !== undefined) setRemixMood(u.mood);
                                if ("tempo" in u) setRemixTempo(u.tempo);
                                if (u.musicalKey !== undefined) setRemixKey(u.musicalKey);
                            }}
                            onExtend={handleExtend}
                            onRemix={handleRemix}
                            onCloseExtend={() => setShowExtendForm(false)}
                            onCloseRemix={() => setShowRemixForm(false)}
                        />
                    }
                />

                {/* Bottom spacer for player clearance */}
                <div className="h-20"/>
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
    const {t} = useTranslation();
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
                <Loader2 className="w-3 h-3 animate-spin"/>
            ) : (
                <Wand2 className="w-3 h-3"/>
            )}
            {t("common.ai")}
        </button>
    );
}

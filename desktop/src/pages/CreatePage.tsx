import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {AnimatePresence, motion} from "framer-motion";
import {
    AlertCircle,
    CheckCircle,
    Clock,
    Globe,
    Guitar,
    KeyRound,
    Loader2,
    Mic,
    Music,
    Paintbrush,
    Plus,
    SlidersHorizontal,
    Sparkles,
    Type,
    Upload,
    VolumeX,
    Wand2,
    X,
    Zap,
} from "lucide-react";
import type {ExtendRequest, Generation, RemixRequest, TaskType} from "../types";
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
    genreColors,
    moodGradients,
    sectionVariants,
    STRUCTURE_TAGS,
} from "../constants/musicOptions";
import {MUSIC_TEMPLATES} from "../constants/templates";
import {formatSeconds} from "../utils/format";
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
    const [globalPolishing, setGlobalPolishing] = useState(false);
    const smartFillingRef = useRef(false);
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
    const [styleAnalyzing, setStyleAnalyzing] = useState(false);
    const referenceAudioInputRef = useRef<HTMLInputElement>(null);
    const srcAudioInputRef = useRef<HTMLInputElement>(null);
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

    /* -- Apply a template to the prompt -- */
    const handleApplyTemplate = useCallback((templateId: string) => {
        const tpl = MUSIC_TEMPLATES.find(t => t.id === templateId);
        if (!tpl) return;
        store.setPrompt(tpl.prompt);
        store.setLanguage(tpl.language);
        store.setInstrumental(tpl.instrumental);
        store.applyAiSuggestions({
            genres: tpl.genre,
            moods: tpl.mood,
        });
    }, [store]);

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
                duration: store.duration,
                title: store.title || undefined,
            });
            // Backend returns LRC format; display plain text in textarea
            store.setLyrics(res.lyrics);
            store.setLyricsAiGenerated(true);
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
                prompt: store.prompt,
                lyrics: store.lyrics || undefined,
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

    /* -- AI: Global polish (one-click enhance all fields) -- */
    const handleGlobalPolish = useCallback(async () => {
        if (!store.prompt.trim()) {
            store.setErrorMessage(t("create.pleaseEnterDescription"));
            return;
        }
        setGlobalPolishing(true);
        store.setErrorMessage(null);

        let style: import("../types").StyleSuggestion | null = null;

        try {
            // Step 1: Suggest style
            style = await api.suggestStyle({prompt: store.prompt.trim()});
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
        } catch {
            // Style suggestion failed, continue with other steps
        }

        // Step 2: Generate lyrics if none exist and not instrumental
        const currentStore = useCreateStore.getState();
        if (!currentStore.lyrics?.trim() && !currentStore.instrumental) {
            try {
                const genre = style?.genres?.join(", ") || currentStore.selectedGenres.join(", ");
                const mood = style?.moods?.join(", ") || currentStore.selectedMoods.join(", ");
                const lyricsRes = await api.generateLyrics({
                    prompt: currentStore.prompt.trim(),
                    genre: genre || undefined,
                    mood: mood || undefined,
                    language: currentStore.language,
                    duration: currentStore.duration,
                    title: style?.title_suggestion || currentStore.title || undefined,
                });
                if (lyricsRes?.lyrics) {
                    store.setLyrics(lyricsRes.lyrics);
                    store.setLyricsAiGenerated(true);
                }
            } catch {
                // Lyrics generation failed, continue
            }
        }

        // Step 3: Generate title if still empty
        const latestStore = useCreateStore.getState();
        if (!latestStore.title?.trim()) {
            try {
                const titleRes = await api.generateTitle({
                    prompt: latestStore.prompt.trim(),
                    lyrics: latestStore.lyrics || undefined,
                    genre: style?.genres?.[0] || latestStore.selectedGenres[0],
                    mood: style?.moods?.[0] || latestStore.selectedMoods[0],
                });
                store.setTitle(titleRes.title);
            } catch {
                // Title generation is optional
            }
        }

        store.setSuccessMessage(t("create.globalPolishSuccess"));
        setGlobalPolishing(false);
    }, [store, t]);

    /* -- AI: Analyze style reference (Smart mode) -- */
    const handleAnalyzeStyle = useCallback(async () => {
        if (!store.styleReferenceText.trim()) return;
        setStyleAnalyzing(true);
        try {
            const result = await api.analyzeStyleReference(store.styleReferenceText.trim());
            if (result.caption) {
                // Prepend the style caption to the prompt for richer generation
                const currentPrompt = store.prompt.trim();
                if (currentPrompt && !currentPrompt.includes(result.caption)) {
                    store.setPrompt(currentPrompt);
                }
            }
            store.applyAiSuggestions({
                genres: result.genre ? [result.genre] : undefined,
                moods: result.mood ? [result.mood] : undefined,
                tempo: result.tempo || undefined,
                musicalKey: result.musical_key || undefined,
                instruments: result.instruments?.length ? result.instruments : undefined,
            });
            store.setSuccessMessage(t("create.styleAnalyzed"));
        } catch {
            store.setErrorMessage(t("create.styleAnalyzeFailed"));
        } finally {
            setStyleAnalyzing(false);
        }
    }, [store, t]);

    /* -- Generate music -- */
    const handleGenerate = useCallback(async () => {
        if (!store.prompt.trim()) {
            store.setErrorMessage(t("create.pleaseEnterDescription"));
            return;
        }

        // Simple mode: auto-fill via AI before generating
        // Run whenever smart mode has no lyrics yet (even if user selected genres via template)
        if (store.mode === "smart" && !store.lyrics) {
            smartFillingRef.current = true;
            store.setGenerationStatus("pending");
            store.setProgress(0);
            store.setErrorMessage(null);

            let style: import("../types").StyleSuggestion | null = null;
            let lyricsText: string | null = null;

            // Step 1: Get style suggestions first so we can pass genre/mood to lyrics
            try {
                style = await api.suggestStyle({prompt: store.prompt.trim()});
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
            } catch {
                // Style suggestion failed, continue without it
            }

            // Step 2: Generate lyrics WITH the suggested genre/mood context
            if (!store.instrumental) {
                try {
                    const genre = style?.genres?.join(", ");
                    const mood = style?.moods?.join(", ");
                    const lyricsRes = await api.generateLyrics({
                        prompt: store.prompt.trim(),
                        genre: genre,
                        mood: mood,
                        language: store.language,
                        duration: store.duration,
                        title: style?.title_suggestion || store.title || undefined,
                    });
                    if (lyricsRes?.lyrics) {
                        lyricsText = lyricsRes.lyrics;
                        store.setLyrics(lyricsText);
                        store.setLyricsAiGenerated(true);
                    }
                } catch {
                    // Lyrics generation failed, proceed without lyrics
                }
            }

            // Step 3: Generate title if no title from style suggestions
            if (!style?.title_suggestion) {
                try {
                    const titleRes = await api.generateTitle({
                        prompt: store.prompt.trim(),
                        lyrics: lyricsText || undefined,
                        genre: style?.genres?.[0],
                        mood: style?.moods?.[0],
                    });
                    store.setTitle(titleRes.title);
                } catch {
                    // Title generation is optional
                }
            }

            smartFillingRef.current = false;
        } else {
            store.setGenerationStatus("pending");
            store.setProgress(0);
            store.setErrorMessage(null);
        }

        try {
            const currentStore = useCreateStore.getState();
            // If no lyrics provided and not explicitly instrumental, force instrumental
            const effectiveInstrumental = currentStore.instrumental || !currentStore.lyrics?.trim();
            const reqFields = {
                prompt: currentStore.prompt.trim(),
                lyrics: currentStore.lyrics || undefined,
                genre: currentStore.selectedGenres.join(", ") || undefined,
                mood: currentStore.selectedMoods.join(", ") || undefined,
                duration: currentStore.duration,
                title: currentStore.title || undefined,
                tempo: currentStore.tempo || undefined,
                musical_key: currentStore.musicalKey || undefined,
                instruments: currentStore.instruments.length > 0 ? currentStore.instruments : undefined,
                language: currentStore.language,
                instrumental: effectiveInstrumental,
                // Signal that lyrics were AI-generated so backend skips format_lyrics
                generate_lyrics: currentStore.lyricsAiGenerated,
                task_type: currentStore.taskType as TaskType,
                audio_cover_strength: currentStore.audioCoverStrength,
                cover_noise_strength: currentStore.coverNoiseStrength,
                repainting_start: currentStore.repaintingStart,
                repainting_end: currentStore.repaintingEnd || undefined,
            };

            // Use multipart endpoint when audio files are present
            const hasAudioFiles = currentStore.referenceAudioFile || currentStore.srcAudioFile;
            const res = hasAudioFiles
                ? await api.generateMusicWithAudio({
                    formFields: reqFields,
                    referenceAudio: currentStore.referenceAudioFile || undefined,
                    srcAudio: currentStore.srcAudioFile || undefined,
                })
                : await api.generateMusic(reqFields);
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
                        {store.mode === "smart" ? t("create.simpleSubtitle") : t("create.subtitle")}
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
                            placeholder={store.mode === "smart" ? t("create.simplePlaceholder") : t("create.placeholder")}
                            rows={store.mode === "smart" ? 4 : 3}
                            className="w-full px-4 py-3 rounded-xl border border-border
                         bg-surface-secondary text-sm text-text-primary leading-relaxed
                         placeholder:text-text-tertiary/60 focus:outline-none
                         focus:ring-2 focus:ring-primary-200
                         focus:border-primary-300 resize-none transition-all"
                        />
                    </div>

                    {/* Simple Mode: inline options row */}
                    {store.mode === "smart" && (
                        <div className="px-5 pb-5 space-y-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Instrumental toggle switch */}
                                <div className="flex items-center gap-2">
                                    <Mic className="w-3.5 h-3.5 text-text-tertiary"/>
                                    <span className={`text-[11px] font-medium ${!store.instrumental ? "text-text-primary" : "text-text-tertiary"}`}>
                                        {t("create.vocals")}
                                    </span>
                                    <button
                                        onClick={() => store.setInstrumental(!store.instrumental)}
                                        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${store.instrumental ? "bg-primary-500" : "bg-gray-300"}`}
                                        aria-label={store.instrumental ? t("create.instrumental") : t("create.vocals")}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${store.instrumental ? "translate-x-5" : ""}`}/>
                                    </button>
                                    <span className={`text-[11px] font-medium ${store.instrumental ? "text-text-primary" : "text-text-tertiary"}`}>
                                        {t("create.instrumental")}
                                    </span>
                                    <VolumeX className="w-3.5 h-3.5 text-text-tertiary"/>
                                </div>

                                {/* Language selector (only when vocals) */}
                                {!store.instrumental && (
                                    <div className="flex items-center gap-1.5">
                                        <Globe className="w-3 h-3 text-text-tertiary"/>
                                        <CustomSelect
                                            value={store.language}
                                            onChange={(v) => store.setLanguage(v)}
                                            options={LANGUAGE_OPTIONS}
                                            labelFn={(opt) => t(`tags.languages.${opt}`, opt)}
                                            compact
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* ================================================================
            SECTION: Template cards (Smart mode only)
           ================================================================ */}
                {store.mode === "smart" && (
                    <motion.div
                        variants={sectionVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{delay: 0.08, duration: 0.35}}
                    >
                        <p className="text-[12px] font-semibold text-text-tertiary mb-2.5 px-1">
                            {t("templates.title")}
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                            {MUSIC_TEMPLATES.map((tpl) => (
                                <button
                                    key={tpl.id}
                                    onClick={() => handleApplyTemplate(tpl.id)}
                                    className="group relative bg-white rounded-xl border border-border shadow-sm
                                           p-3.5 text-left transition-all cursor-pointer
                                           hover:border-primary-300 hover:shadow-md active:scale-[0.98]"
                                >
                                    <div className="flex items-start gap-2.5">
                                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${tpl.gradient}
                                                    flex items-center justify-center flex-shrink-0 text-lg`}>
                                            {tpl.icon}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[13px] font-semibold text-text-primary truncate">
                                                {t(tpl.nameKey)}
                                            </p>
                                            <p className="text-[11px] text-text-tertiary mt-0.5 line-clamp-2 leading-relaxed">
                                                {t(tpl.descKey)}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}

                {/* ================================================================
            SECTION: Style Reference (Smart mode - text only)
           ================================================================ */}
                {store.mode === "smart" && (
                    <motion.div
                        variants={sectionVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{delay: 0.11, duration: 0.35}}
                        className="bg-white rounded-2xl border border-border shadow-sm p-5"
                    >
                        <div className="flex items-center justify-between mb-2.5">
                            <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                                <Paintbrush className="w-4 h-4 text-accent-500"/>
                                {t("create.styleReference")}
                            </label>
                            <button
                                onClick={handleAnalyzeStyle}
                                disabled={!store.styleReferenceText.trim() || styleAnalyzing}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium
                                     text-primary-600 hover:bg-primary-50
                                     transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed
                                     border border-transparent hover:border-primary-200"
                            >
                                {styleAnalyzing ? (
                                    <Loader2 className="w-3 h-3 animate-spin"/>
                                ) : (
                                    <Wand2 className="w-3 h-3"/>
                                )}
                                {styleAnalyzing ? t("create.analyzingStyle") : t("create.analyzeStyle")}
                            </button>
                        </div>
                        <textarea
                            value={store.styleReferenceText}
                            onChange={(e) => store.setStyleReferenceText(e.target.value)}
                            placeholder={t("create.styleReferencePlaceholder")}
                            rows={2}
                            className="w-full px-4 py-2.5 rounded-xl border border-border
                                 bg-surface-secondary text-sm text-text-primary leading-relaxed
                                 placeholder:text-text-tertiary/60 focus:outline-none
                                 focus:ring-2 focus:ring-primary-200
                                 focus:border-primary-300 resize-none transition-all"
                        />
                    </motion.div>
                )}

                {/* ================================================================
            SECTION: Title (Custom mode only)
           ================================================================ */}
                {store.mode === "custom" && (
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
                )}

                {/* ================================================================
            SECTION: Lyrics (Custom mode only)
           ================================================================ */}
                {store.mode === "custom" && (
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
                                <div className="flex items-center gap-2">
                                    <Mic className="w-3.5 h-3.5 text-text-tertiary"/>
                                    <span className={`text-[11px] font-medium ${!store.instrumental ? "text-text-primary" : "text-text-tertiary"}`}>
                                        {t("create.vocals")}
                                    </span>
                                    <button
                                        onClick={() => store.setInstrumental(!store.instrumental)}
                                        className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${store.instrumental ? "bg-primary-500" : "bg-gray-300"}`}
                                        aria-label={store.instrumental ? t("create.instrumental") : t("create.vocals")}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${store.instrumental ? "translate-x-5" : ""}`}/>
                                    </button>
                                    <span className={`text-[11px] font-medium ${store.instrumental ? "text-text-primary" : "text-text-tertiary"}`}>
                                        {t("create.instrumental")}
                                    </span>
                                    <VolumeX className="w-3.5 h-3.5 text-text-tertiary"/>
                                </div>
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
                                    onChange={(e) => { store.setLyrics(e.target.value); store.setLyricsAiGenerated(false); }}
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
                )}

                {/* ================================================================
            SECTION: Style Reference - Audio (Custom mode only)
           ================================================================ */}
                {store.mode === "custom" && (
                    <motion.div
                        variants={sectionVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{delay: 0.13, duration: 0.35}}
                        className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-4"
                    >
                        <label className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                            <Paintbrush className="w-4 h-4 text-accent-500"/>
                            {t("create.styleReference")}
                        </label>

                        {/* Task mode selector */}
                        <div>
                            <p className="text-[11px] font-medium text-text-tertiary mb-2">{t("create.taskType")}</p>
                            <div className="flex gap-2">
                                {(["text2music", "cover", "repaint"] as TaskType[]).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => store.setTaskType(mode)}
                                        className={`flex-1 py-2 px-3 rounded-xl text-[12px] font-medium transition-all cursor-pointer border
                                            ${store.taskType === mode
                                            ? "bg-primary-50 text-primary-700 border-primary-300 shadow-sm"
                                            : "bg-surface-secondary text-text-secondary border-border hover:border-primary-200"
                                        }`}
                                    >
                                        <div className="text-center">
                                            <span className="block">{t(`create.${mode}`)}</span>
                                            <span className="text-[10px] opacity-60">{t(`create.${mode}Desc`)}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Reference audio upload (all modes) */}
                        <div>
                            <p className="text-[11px] font-medium text-text-tertiary mb-1.5">{t("create.referenceAudio")}</p>
                            <p className="text-[10px] text-text-tertiary/60 mb-2">{t("create.referenceAudioHint")}</p>
                            <input
                                ref={referenceAudioInputRef}
                                type="file"
                                accept=".mp3,.wav,.flac,.ogg,.m4a,.aac"
                                className="hidden"
                                onChange={(e) => store.setReferenceAudioFile(e.target.files?.[0] || null)}
                            />
                            {store.referenceAudioFile ? (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-50 border border-primary-200">
                                    <Music className="w-4 h-4 text-primary-500 flex-shrink-0"/>
                                    <span className="text-[12px] text-primary-700 truncate flex-1">{store.referenceAudioFile.name}</span>
                                    <button
                                        onClick={() => { store.setReferenceAudioFile(null); if (referenceAudioInputRef.current) referenceAudioInputRef.current.value = ""; }}
                                        className="p-0.5 hover:bg-primary-100 rounded cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5 text-primary-500"/>
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={() => referenceAudioInputRef.current?.click()}
                                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed
                                             border-border hover:border-primary-300 bg-surface-secondary
                                             text-[12px] text-text-tertiary hover:text-primary-600
                                             transition-all cursor-pointer"
                                >
                                    <Upload className="w-4 h-4"/>
                                    {t("create.dropAudioHere")}
                                </button>
                            )}
                        </div>

                        {/* Source audio upload (cover/repaint modes only) */}
                        {(store.taskType === "cover" || store.taskType === "repaint") && (
                            <div>
                                <p className="text-[11px] font-medium text-text-tertiary mb-1.5">{t("create.srcAudio")}</p>
                                <p className="text-[10px] text-text-tertiary/60 mb-2">{t("create.srcAudioHint")}</p>
                                <input
                                    ref={srcAudioInputRef}
                                    type="file"
                                    accept=".mp3,.wav,.flac,.ogg,.m4a,.aac"
                                    className="hidden"
                                    onChange={(e) => store.setSrcAudioFile(e.target.files?.[0] || null)}
                                />
                                {store.srcAudioFile ? (
                                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-50 border border-primary-200">
                                        <Music className="w-4 h-4 text-primary-500 flex-shrink-0"/>
                                        <span className="text-[12px] text-primary-700 truncate flex-1">{store.srcAudioFile.name}</span>
                                        <button
                                            onClick={() => { store.setSrcAudioFile(null); if (srcAudioInputRef.current) srcAudioInputRef.current.value = ""; }}
                                            className="p-0.5 hover:bg-primary-100 rounded cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5 text-primary-500"/>
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => srcAudioInputRef.current?.click()}
                                        className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed
                                                 border-border hover:border-primary-300 bg-surface-secondary
                                                 text-[12px] text-text-tertiary hover:text-primary-600
                                                 transition-all cursor-pointer"
                                    >
                                        <Upload className="w-4 h-4"/>
                                        {t("create.dropAudioHere")}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Cover strength slider (cover mode only) */}
                        {store.taskType === "cover" && (
                            <div className="space-y-3">
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-[11px] font-medium text-text-tertiary">{t("create.coverStrength")}</p>
                                        <span className="text-[11px] font-bold text-text-primary tabular-nums">
                                            {Math.round(store.audioCoverStrength * 100)}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={5}
                                        value={Math.round(store.audioCoverStrength * 100)}
                                        onChange={(e) => store.setAudioCoverStrength(Number(e.target.value) / 100)}
                                        className="w-full accent-primary-600 cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <p className="text-[11px] font-medium text-text-tertiary">{t("create.coverNoise")}</p>
                                        <span className="text-[11px] font-bold text-text-primary tabular-nums">
                                            {Math.round(store.coverNoiseStrength * 100)}%
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={5}
                                        value={Math.round(store.coverNoiseStrength * 100)}
                                        onChange={(e) => store.setCoverNoiseStrength(Number(e.target.value) / 100)}
                                        className="w-full accent-primary-600 cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Repaint time range (repaint mode only) */}
                        {store.taskType === "repaint" && (
                            <div>
                                <p className="text-[11px] font-medium text-text-tertiary mb-2">{t("create.repaintRange")}</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1">
                                        <label className="text-[10px] text-text-tertiary">{t("create.repaintStart")}</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={store.repaintingStart}
                                            onChange={(e) => store.setRepaintingStart(Number(e.target.value))}
                                            className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-surface-secondary
                                                     text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
                                        />
                                    </div>
                                    <span className="text-text-tertiary mt-4">—</span>
                                    <div className="flex-1">
                                        <label className="text-[10px] text-text-tertiary">{t("create.repaintEnd")}</label>
                                        <input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={store.repaintingEnd || ""}
                                            onChange={(e) => store.setRepaintingEnd(Number(e.target.value) || 0)}
                                            className="w-full mt-1 px-3 py-2 rounded-lg border border-border bg-surface-secondary
                                                     text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <p className="text-[10px] text-text-tertiary/60">{t("create.supportedFormats")}</p>
                    </motion.div>
                )}

                {/* ================================================================
            SECTION: Style -- Genre & Mood (Custom mode only)
           ================================================================ */}
                {store.mode === "custom" && (
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
                )}

                {/* ================================================================
            SECTION: Sound -- Duration, Key, Instruments (Custom mode only)
           ================================================================ */}
                {store.mode === "custom" && (
                    <motion.div
                        variants={sectionVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{delay: 0.17, duration: 0.35}}
                        className="bg-white rounded-2xl border border-border shadow-sm p-5 space-y-5"
                    >
                        {/* Duration -- controls track length (instrumental) or lyrics length (vocal) */}
                        <div>
                                <label
                                    className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5 mb-3">
                                    <Clock className="w-4 h-4 text-primary-500"/>
                                    {t("create.duration")}
                                </label>
                                <div className="bg-surface-secondary rounded-xl p-3 border border-border-light">
                                    <div className="text-center mb-2">
                  <span className="text-lg font-bold text-text-primary tabular-nums">
                    {formatSeconds(store.duration)}
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
            SECTION: Generate Button
           ================================================================ */}
                <motion.div
                    variants={sectionVariants}
                    initial="hidden"
                    animate="visible"
                    transition={{delay: store.mode === "smart" ? 0.1 : 0.2, duration: 0.35}}
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
                    {store.mode === "smart" && (
                        <p className="text-center text-[11px] text-text-tertiary mt-2">
                            {t("create.simpleHint")}
                        </p>
                    )}
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

            {/* Floating AI Polish button */}
            <AnimatePresence>
                {(store.mode === "custom" || store.mode === "smart") && store.prompt.trim() && (
                    <motion.div
                        initial={{opacity: 0, x: 20, scale: 0.9}}
                        animate={{opacity: 1, x: 0, scale: 1}}
                        exit={{opacity: 0, x: 20, scale: 0.9}}
                        transition={{duration: 0.25, ease: "easeOut"}}
                        className="fixed right-6 bottom-28 z-40 flex flex-col items-end gap-1"
                    >
                        <motion.button
                            whileHover={{scale: 1.04}}
                            whileTap={{scale: 0.97}}
                            onClick={handleGlobalPolish}
                            disabled={globalPolishing || isGenerating}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold
                                       text-white bg-gradient-to-r from-primary-600 to-accent-500
                                       shadow-lg shadow-primary-300/40
                                       disabled:opacity-40 disabled:cursor-not-allowed
                                       transition-all cursor-pointer"
                        >
                            {globalPolishing ? (
                                <Loader2 className="w-4 h-4 animate-spin"/>
                            ) : (
                                <Wand2 className="w-4 h-4"/>
                            )}
                            {globalPolishing ? t("create.globalPolishing") : t("create.globalPolish")}
                        </motion.button>
                        {store.mode === "custom" && (
                            <span className="text-[10px] text-text-tertiary mr-1">
                                {t("create.globalPolishHint")}
                            </span>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
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

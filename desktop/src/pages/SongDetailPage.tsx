import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {
    ArrowLeft,
    Calendar,
    Clock,
    Download,
    Gauge,
    GitBranch,
    Globe,
    Heart,
    Image,
    Loader2,
    Music2,
    Pause,
    Piano,
    Play,
    Repeat,
    Shuffle,
    Trash2,
} from "lucide-react";
import {useAppStore} from "../stores/appStore";
import {usePlayerStore} from "../stores/playerStore";
import {useLibraryStore} from "../stores/libraryStore";
import {useTrackActions} from "../hooks/useTrackActions";
import {api} from "../services/api";
import {formatDate, formatSeconds, getGradient} from "../utils/format";
import type {Generation} from "../types";
import MetadataCard from "../components/detail/MetadataCard";
import DetailLyricsPanel from "../components/detail/DetailLyricsPanel";
import ConfirmDialog from "../components/ConfirmDialog";

export default function SongDetailPage() {
    const {t} = useTranslation();
    const detailGenerationId = useAppStore((s) => s.detailGenerationId);
    const closeDetail = useAppStore((s) => s.closeDetail);
    const openDetail = useAppStore((s) => s.openDetail);

    const currentTrack = usePlayerStore((s) => s.currentTrack);
    const isPlaying = usePlayerStore((s) => s.isPlaying);
    const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
    const currentTime = usePlayerStore((s) => s.currentTime);
    const duration = usePlayerStore((s) => s.duration);
    const play = usePlayerStore((s) => s.play);
    const toggleLike = usePlayerStore((s) => s.toggleLike);

    const libraryGenerations = useLibraryStore((s) => s.generations);
    const deleteGeneration = useLibraryStore((s) => s.deleteGeneration);
    const updateGeneration = useLibraryStore((s) => s.updateGeneration);

    const {handleExtend, handleRemix, handleRegenerateCover} = useTrackActions();

    const [generation, setGeneration] = useState<Generation | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [coverLoading, setCoverLoading] = useState(false);

    // Load generation data
    useEffect(() => {
        if (!detailGenerationId) return;

        // Try library cache first
        const cached = libraryGenerations.find((g) => g.id === detailGenerationId);
        if (cached) {
            setGeneration(cached);
            setLoading(false);
        }

        // Also fetch from API for freshest data
        api.getGeneration(detailGenerationId)
            .then((data) => {
                setGeneration(data);
                setLoading(false);
            })
            .catch(() => {
                if (!cached) setLoading(false);
            });
    }, [detailGenerationId, libraryGenerations]);

    // Sync with library store updates
    useEffect(() => {
        if (!detailGenerationId) return;
        const updated = libraryGenerations.find((g) => g.id === detailGenerationId);
        if (updated) setGeneration(updated);
    }, [libraryGenerations, detailGenerationId]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-text-tertiary"/>
            </div>
        );
    }

    if (!generation) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <p className="text-text-tertiary text-sm">{t("detail.notFound", "Song not found")}</p>
                <button onClick={closeDetail} className="text-primary-600 text-sm font-medium cursor-pointer hover:underline">
                    {t("detail.backToLibrary")}
                </button>
            </div>
        );
    }

    const isThisTrackPlaying = currentTrack?.id === generation.id;
    const isThisTrackActive = isThisTrackPlaying && isPlaying;
    const displayTitle = generation.title || generation.prompt.slice(0, 60);
    const hasCover = !!generation.cover_art_path;
    const gradient = getGradient(generation.genre);

    const handlePlay = () => {
        if (isThisTrackPlaying) {
            setIsPlaying(!isPlaying);
        } else {
            play(generation);
        }
    };

    const handleDownload = () => {
        if (!generation.audio_path) return;
        const url = api.getAudioUrl(generation.audio_path);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${displayTitle}.wav`;
        a.click();
    };

    const handleDelete = async () => {
        await deleteGeneration(generation.id);
        closeDetail();
    };

    const handleRegenCover = async () => {
        setCoverLoading(true);
        await handleRegenerateCover(generation, updateGeneration);
        setCoverLoading(false);
    };

    return (
        <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6">
                {/* Back button */}
                <button
                    onClick={closeDetail}
                    className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary
                             transition-colors cursor-pointer mb-6"
                >
                    <ArrowLeft className="w-4 h-4"/>
                    {t("detail.backToLibrary")}
                </button>

                {/* Hero section */}
                <div className="flex gap-8 mb-8">
                    {/* Cover art */}
                    <div className="relative flex-shrink-0">
                        <div className={`w-64 h-64 rounded-2xl overflow-hidden shadow-lg ${
                            !hasCover ? `bg-gradient-to-br ${gradient}` : ""
                        } ${isThisTrackActive ? "animate-spin-slow" : ""}`}
                             style={isThisTrackActive ? {borderRadius: "50%"} : {}}
                        >
                            {hasCover ? (
                                <img
                                    src={api.getCoverArtUrl(generation.cover_art_path!)}
                                    alt="Cover"
                                    className={`w-full h-full object-cover ${coverLoading ? "opacity-40" : ""}`}
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Music2 className="w-16 h-16 text-white/20"/>
                                </div>
                            )}
                        </div>
                        {coverLoading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 animate-spin text-white"/>
                            </div>
                        )}
                    </div>

                    {/* Song info */}
                    <div className="flex-1 min-w-0 pt-2">
                        <h1 className="text-2xl font-bold text-text-primary mb-2 leading-tight">
                            {displayTitle}
                        </h1>

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-4">
                            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
                                generation.instrumental
                                    ? "bg-blue-50 text-blue-600"
                                    : "bg-green-50 text-green-600"
                            }`}>
                                {generation.instrumental ? t("detail.instrumental") : t("detail.vocal")}
                            </span>
                            {generation.genre && (
                                <span className="text-[11px] px-2.5 py-1 rounded-full bg-primary-50 text-primary-600 font-medium">
                                    {generation.genre}
                                </span>
                            )}
                            {generation.mood && (
                                <span className="text-[11px] px-2.5 py-1 rounded-full bg-accent-50 text-accent-500 font-medium">
                                    {generation.mood}
                                </span>
                            )}
                        </div>

                        {/* Lineage */}
                        {generation.parent_id && generation.parent_type && (
                            <div className="flex items-center gap-1.5 text-[12px] text-text-tertiary mb-4">
                                <GitBranch className="w-3.5 h-3.5"/>
                                <span>
                                    {generation.parent_type === "extend"
                                        ? t("detail.extendedFrom")
                                        : t("detail.remixOf")}
                                </span>
                                <button
                                    onClick={() => openDetail(generation.parent_id!)}
                                    className="text-primary-600 hover:underline cursor-pointer font-medium"
                                >
                                    {t("detail.viewParent")}
                                </button>
                            </div>
                        )}

                        {/* Action bar */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={handlePlay}
                                disabled={generation.status !== "completed"}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl
                                         bg-primary-600 hover:bg-primary-700 text-white
                                         font-medium text-sm transition-colors cursor-pointer
                                         disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            >
                                {isThisTrackActive ? (
                                    <Pause className="w-4 h-4"/>
                                ) : (
                                    <Play className="w-4 h-4 ml-0.5"/>
                                )}
                                {isThisTrackActive ? t("detail.pause") : t("detail.play")}
                            </button>

                            <button
                                onClick={() => toggleLike(generation.id)}
                                className={`p-2.5 rounded-xl border transition-colors cursor-pointer ${
                                    generation.is_liked
                                        ? "bg-red-50 border-red-200 text-red-500"
                                        : "bg-white border-border text-text-tertiary hover:text-red-500 hover:border-red-200"
                                }`}
                                title={generation.is_liked ? t("detail.unlike") : t("detail.like")}
                            >
                                <Heart className={`w-4 h-4 ${generation.is_liked ? "fill-current" : ""}`}/>
                            </button>

                            <button
                                onClick={() => handleExtend(generation)}
                                className="p-2.5 rounded-xl border border-border bg-white
                                         text-text-tertiary hover:text-primary-600 hover:border-primary-200
                                         transition-colors cursor-pointer"
                                title={t("detail.extend")}
                            >
                                <Repeat className="w-4 h-4"/>
                            </button>

                            <button
                                onClick={() => handleRemix(generation)}
                                className="p-2.5 rounded-xl border border-border bg-white
                                         text-text-tertiary hover:text-accent-500 hover:border-accent-200
                                         transition-colors cursor-pointer"
                                title={t("detail.remix")}
                            >
                                <Shuffle className="w-4 h-4"/>
                            </button>

                            <button
                                onClick={handleRegenCover}
                                className="p-2.5 rounded-xl border border-border bg-white
                                         text-text-tertiary hover:text-blue-500 hover:border-blue-200
                                         transition-colors cursor-pointer"
                                title={t("library.regenCover")}
                            >
                                <Image className="w-4 h-4"/>
                            </button>

                            <button
                                onClick={handleDownload}
                                disabled={!generation.audio_path}
                                className="p-2.5 rounded-xl border border-border bg-white
                                         text-text-tertiary hover:text-green-600 hover:border-green-200
                                         transition-colors cursor-pointer
                                         disabled:opacity-40 disabled:cursor-not-allowed"
                                title={t("detail.download")}
                            >
                                <Download className="w-4 h-4"/>
                            </button>

                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="p-2.5 rounded-xl border border-border bg-white
                                         text-text-tertiary hover:text-red-500 hover:border-red-200
                                         transition-colors cursor-pointer ml-auto"
                                title={t("detail.delete")}
                            >
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                    <MetadataCard icon={Gauge} label={t("detail.tempo")} value={generation.tempo ? `${generation.tempo} ${t("detail.bpm")}` : undefined}/>
                    <MetadataCard icon={Music2} label={t("detail.key")} value={generation.musical_key}/>
                    <MetadataCard icon={Piano} label={t("detail.instruments")} value={generation.instruments?.join(", ")}/>
                    <MetadataCard icon={Globe} label={t("detail.language")} value={generation.language}/>
                    <MetadataCard icon={Clock} label={t("detail.duration")} value={formatSeconds(generation.actual_duration)}/>
                    <MetadataCard icon={Calendar} label={t("detail.createdAt")} value={formatDate(generation.created_at)}/>
                </div>

                {/* Lyrics */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-text-primary mb-4">{t("detail.lyrics")}</h2>
                    <div className="bg-white rounded-2xl border border-border p-6">
                        <DetailLyricsPanel
                            lyrics={generation.lyrics}
                            lrcLyrics={generation.lrc_lyrics}
                            currentTime={currentTime}
                            duration={duration}
                            isCurrentTrack={isThisTrackPlaying}
                        />
                    </div>
                </div>

                {/* Generation prompt */}
                <div className="mb-8">
                    <details className="group">
                        <summary className="text-lg font-semibold text-text-primary cursor-pointer list-none
                                          flex items-center gap-2">
                            <span>{t("detail.prompt")}</span>
                            <span className="text-text-tertiary text-xs font-normal group-open:hidden">
                                ({t("common.close", "click to expand")})
                            </span>
                        </summary>
                        <div className="mt-3 space-y-3">
                            <div className="bg-surface-secondary rounded-xl p-4">
                                <p className="text-[11px] text-text-tertiary font-medium uppercase tracking-wider mb-2">
                                    {t("detail.prompt")}
                                </p>
                                <p className="text-[13px] text-text-secondary leading-relaxed">
                                    {generation.prompt}
                                </p>
                            </div>
                            {generation.enhanced_prompt && (
                                <div className="bg-surface-secondary rounded-xl p-4">
                                    <p className="text-[11px] text-text-tertiary font-medium uppercase tracking-wider mb-2">
                                        {t("detail.enhancedPrompt")}
                                    </p>
                                    <p className="text-[13px] text-text-secondary leading-relaxed">
                                        {generation.enhanced_prompt}
                                    </p>
                                </div>
                            )}
                        </div>
                    </details>
                </div>

                {/* Bottom spacer */}
                <div className="h-24"/>
            </div>

            <ConfirmDialog
                open={showDeleteConfirm}
                title={t("detail.delete")}
                message={t("detail.deleteConfirm")}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </div>
    );
}

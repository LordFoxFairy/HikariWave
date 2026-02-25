import {useCallback, useEffect, useRef, useState} from "react";
import {
    Check,
    ChevronDown,
    Download,
    FileText,
    Music,
    Pause,
    Play,
    SkipBack,
    SkipForward,
    Square,
    Star,
    Volume1,
    Volume2,
    VolumeX,
} from "lucide-react";
import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import WaveSurfer from "wavesurfer.js";
import {usePlayerStore} from "../stores/playerStore";
import {useAppStore} from "../stores/appStore";
import {api} from "../services/api";
import LyricsPanel from "./LyricsPanel";
import {formatSeconds, getGradient} from "../utils/format";

function VolumeIcon({volume}: { volume: number }) {
    if (volume === 0) return <VolumeX className="w-4 h-4 text-text-tertiary"/>;
    if (volume < 0.5) return <Volume1 className="w-4 h-4 text-text-tertiary"/>;
    return <Volume2 className="w-4 h-4 text-text-tertiary"/>;
}

type DownloadFormat = "wav" | "mp3" | "flac";

const FORMAT_OPTIONS: { value: DownloadFormat; label: string; descKey: string }[] = [
    {value: "wav", label: "WAV", descKey: "player.lossless"},
    {value: "mp3", label: "MP3", descKey: "player.compressed"},
    {value: "flac", label: "FLAC", descKey: "player.lossless"},
];

/* --- Toast component --- */
function Toast({
                   message,
                   onDone,
               }: {
    message: string;
    onDone: () => void;
}) {
    useEffect(() => {
        const t = setTimeout(onDone, 3000);
        return () => clearTimeout(t);
    }, [onDone]);

    return (
        <motion.div
            initial={{opacity: 0, y: -12}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0, y: -12}}
            className="fixed bottom-24 right-4 z-50 px-4 py-2.5 rounded-xl
                 bg-white border border-primary-200 text-[13px] text-primary-700
                 font-medium shadow-lg flex items-center gap-2"
        >
            <Download className="w-3.5 h-3.5"/>
            {message}
        </motion.div>
    );
}

export default function Player() {
    const {t} = useTranslation();
    const waveformRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WaveSurfer | null>(null);
    const formatMenuRef = useRef<HTMLDivElement>(null);

    const [showLyrics, setShowLyrics] = useState(false);
    const [showFormatMenu, setShowFormatMenu] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const {
        currentTrack,
        isPlaying,
        volume,
        currentTime,
        duration,
        queue,
        queueIndex,
        setIsPlaying,
        setVolume,
        setCurrentTime,
        setDuration,
        stop,
        toggleLike,
        playNext,
        playPrevious,
    } = usePlayerStore();

    const openDetail = useAppStore((s) => s.openDetail);

    // Close format menu on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (
                formatMenuRef.current &&
                !formatMenuRef.current.contains(e.target as Node)
            ) {
                setShowFormatMenu(false);
            }
        }

        if (showFormatMenu) {
            document.addEventListener("mousedown", handleClick);
            return () => document.removeEventListener("mousedown", handleClick);
        }
    }, [showFormatMenu]);

    const volumeRef = useRef(volume);
    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);

    const initWaveSurfer = useCallback(() => {
        if (!waveformRef.current) return;
        if (wsRef.current) {
            wsRef.current.destroy();
        }
        const ws = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: "#ddd6fe",
            progressColor: "#7c3aed",
            cursorColor: "#7c3aed",
            barWidth: 2,
            barGap: 1.5,
            barRadius: 3,
            height: 36,
            normalize: true,
        });
        ws.on("ready", () => setDuration(ws.getDuration()));
        ws.on("audioprocess", () =>
            setCurrentTime(ws.getCurrentTime()),
        );
        ws.on("finish", () => playNext());
        ws.setVolume(volumeRef.current);
        wsRef.current = ws;
        return ws;
    }, [setDuration, setCurrentTime, playNext]);

    useEffect(() => {
        if (!currentTrack?.audio_path) return;
        const ws = initWaveSurfer();
        if (ws) {
            const url = api.getAudioUrl(currentTrack.audio_path);
            ws.load(url);
            ws.on("ready", () => ws.play());
        }
        return () => {
            wsRef.current?.destroy();
            wsRef.current = null;
        };
    }, [currentTrack, initWaveSurfer]);

    useEffect(() => {
        if (!wsRef.current) return;
        if (isPlaying) wsRef.current.play();
        else wsRef.current.pause();
    }, [isPlaying]);

    useEffect(() => {
        wsRef.current?.setVolume(volume);
    }, [volume]);

    const handleStop = () => {
        wsRef.current?.stop();
        stop();
    };

    const handleDownload = (format: DownloadFormat) => {
        if (!currentTrack?.audio_path) return;
        setShowFormatMenu(false);
        let url = api.getAudioUrl(currentTrack.audio_path);
        if (format !== "wav") {
            url += `?format=${format}`;
        }
        const a = document.createElement("a");
        a.href = url;
        const fileName = currentTrack.title || currentTrack.prompt.slice(0, 30);
        a.download = `${fileName}.${format}`;
        a.click();
        setToastMessage(`${t("player.downloadAs")} ${format.toUpperCase()}...`);
    };

    if (!currentTrack) return null;

    const liked = !!currentTrack.is_liked;
    const gradient = getGradient(currentTrack.genre);
    const hasCover = !!currentTrack.cover_art_path;
    const hasLyrics = !!currentTrack.lyrics || !!currentTrack.lrc_lyrics;
    const displayTitle = currentTrack.title || currentTrack.prompt.slice(0, 40);

    return (
        <>
            {/* Toast */}
            <AnimatePresence>
                {toastMessage && (
                    <Toast
                        message={toastMessage}
                        onDone={() => setToastMessage(null)}
                    />
                )}
            </AnimatePresence>

            <motion.div
                initial={{y: 80, opacity: 0}}
                animate={{y: 0, opacity: 1}}
                transition={{type: "spring", duration: 0.5, bounce: 0.15}}
                className="bg-white border-t border-border flex-shrink-0"
            >
                {/* Lyrics panel (collapsible) */}
                <AnimatePresence>
                    {showLyrics && (
                        <motion.div
                            initial={{height: 0, opacity: 0}}
                            animate={{height: "auto", opacity: 1}}
                            exit={{height: 0, opacity: 0}}
                            transition={{duration: 0.3, ease: "easeInOut"}}
                            className="overflow-hidden border-b border-border-light"
                        >
                            <LyricsPanel
                                lyrics={currentTrack.lyrics}
                                lrcLyrics={currentTrack.lrc_lyrics}
                                currentTime={currentTime}
                                duration={duration}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Player controls bar */}
                <div className="h-[72px] flex items-center px-4 gap-3">
                    {/* Cover art + track info (clickable) */}
                    <div
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => currentTrack && openDetail(currentTrack.id)}
                    >
                        {/* Cover art / genre thumbnail */}
                        {hasCover ? (
                            <img
                                src={api.getCoverArtUrl(currentTrack.cover_art_path!)}
                                alt="Cover"
                                className="w-11 h-11 rounded-lg object-cover flex-shrink-0 shadow-sm"
                            />
                        ) : (
                            <div
                                className={`w-11 h-11 rounded-lg bg-gradient-to-br ${gradient}
                                flex items-center justify-center flex-shrink-0
                                shadow-sm`}
                            >
                                <Music className="w-5 h-5 text-white/80"/>
                            </div>
                        )}

                        {/* Track info */}
                        <div className="w-40 flex-shrink-0 min-w-0">
                            <p className="text-[13px] font-semibold text-text-primary truncate leading-tight">
                                {displayTitle}
                            </p>
                            <p className="text-[11px] text-text-tertiary mt-0.5 truncate">
                                {currentTrack.genre || t("player.generated")}
                            </p>
                        </div>
                    </div>

                    {/* Star */}
                    <button
                        onClick={() => toggleLike(currentTrack.id)}
                        className="p-1.5 rounded-full hover:bg-surface-tertiary
                         transition-colors cursor-pointer flex-shrink-0"
                    >
                        <Star
                            className={`w-4 h-4 transition-colors ${
                                liked
                                    ? "fill-amber-500 text-amber-500"
                                    : "text-text-tertiary hover:text-amber-500"
                            }`}
                        />
                    </button>

                    {/* Lyrics toggle */}
                    <button
                        onClick={() => setShowLyrics(!showLyrics)}
                        className={`p-1.5 rounded-full transition-all cursor-pointer flex-shrink-0 ${
                            showLyrics
                                ? "bg-primary-100 text-primary-600"
                                : hasLyrics
                                    ? "hover:bg-surface-tertiary text-text-tertiary hover:text-text-secondary"
                                    : "text-text-tertiary opacity-30 cursor-not-allowed"
                        }`}
                        disabled={!hasLyrics}
                        title={hasLyrics ? t("player.toggleLyrics") : t("player.noLyricsAvailable")}
                    >
                        <FileText className="w-4 h-4"/>
                    </button>

                    {/* Playback controls */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleStop}
                            className="w-8 h-8 rounded-full hover:bg-surface-tertiary
                           flex items-center justify-center
                           transition-colors cursor-pointer"
                        >
                            <Square className="w-3.5 h-3.5 text-text-tertiary"/>
                        </button>
                        <button
                            onClick={playPrevious}
                            disabled={queue.length === 0 || queueIndex <= 0}
                            className="w-8 h-8 rounded-full hover:bg-surface-tertiary
                           flex items-center justify-center
                           transition-colors cursor-pointer
                           disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <SkipBack className="w-3.5 h-3.5 text-text-tertiary"/>
                        </button>
                        <button
                            onClick={() => setIsPlaying(!isPlaying)}
                            className="w-9 h-9 rounded-full bg-primary-600
                           hover:bg-primary-700 flex items-center
                           justify-center transition-colors
                           cursor-pointer shadow-sm active:scale-95"
                        >
                            {isPlaying ? (
                                <Pause className="w-4 h-4 text-white"/>
                            ) : (
                                <Play className="w-4 h-4 text-white ml-0.5"/>
                            )}
                        </button>
                        <button
                            onClick={playNext}
                            disabled={queue.length === 0 || queueIndex >= queue.length - 1}
                            className="w-8 h-8 rounded-full hover:bg-surface-tertiary
                           flex items-center justify-center
                           transition-colors cursor-pointer
                           disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <SkipForward className="w-3.5 h-3.5 text-text-tertiary"/>
                        </button>
                    </div>

                    {/* Queue position */}
                    {queue.length > 1 && (
                        <span className="text-[10px] text-text-tertiary tabular-nums flex-shrink-0">
                {queueIndex + 1} / {queue.length}
              </span>
                    )}

                    {/* Time + Waveform */}
                    <span className="text-[11px] text-text-tertiary w-9
                             text-right tabular-nums flex-shrink-0">
              {formatSeconds(currentTime)}
            </span>
                    <div ref={waveformRef} className="flex-1 mx-1 min-w-0"/>
                    <span className="text-[11px] text-text-tertiary w-9
                             tabular-nums flex-shrink-0">
              {formatSeconds(duration)}
            </span>

                    {/* Volume */}
                    <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
                        <button
                            onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
                            className="cursor-pointer p-1 rounded
                           hover:bg-surface-tertiary transition-colors"
                        >
                            <VolumeIcon volume={volume}/>
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={volume}
                            onChange={(e) => setVolume(Number(e.target.value))}
                            className="flex-1 volume-slider"
                        />
                    </div>

                    {/* Download with format selector */}
                    <div className="relative flex-shrink-0" ref={formatMenuRef}>
                        <button
                            onClick={() => setShowFormatMenu(!showFormatMenu)}
                            className="flex items-center gap-0.5 p-2 rounded-lg hover:bg-surface-tertiary
                           transition-colors cursor-pointer"
                        >
                            <Download className="w-4 h-4 text-text-tertiary hover:text-text-secondary"/>
                            <ChevronDown className="w-2.5 h-2.5 text-text-tertiary"/>
                        </button>

                        <AnimatePresence>
                            {showFormatMenu && (
                                <motion.div
                                    initial={{opacity: 0, y: 4, scale: 0.95}}
                                    animate={{opacity: 1, y: 0, scale: 1}}
                                    exit={{opacity: 0, y: 4, scale: 0.95}}
                                    transition={{duration: 0.12}}
                                    className="absolute bottom-full right-0 mb-2 w-40
                               bg-white rounded-xl border border-border
                               shadow-xl overflow-hidden z-50"
                                >
                                    <div className="py-1.5">
                                        <div className="px-3 py-1.5 text-[10px] font-semibold
                                      text-text-tertiary uppercase tracking-wider">
                                            {t("player.downloadAs")}
                                        </div>
                                        {FORMAT_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                onClick={() => handleDownload(opt.value)}
                                                className="w-full flex items-center gap-2.5 px-3 py-2
                                     text-[13px] text-text-primary hover:bg-surface-tertiary
                                     transition-colors cursor-pointer"
                                            >
                                                {opt.value === "wav" ? (
                                                    <Check className="w-3.5 h-3.5 text-primary-500"/>
                                                ) : (
                                                    <span className="w-3.5"/>
                                                )}
                                                <span className="font-medium">{opt.label}</span>
                                                <span className="text-[10px] text-text-tertiary ml-auto">
                            {t(opt.descKey)}
                          </span>
                                            </button>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>
        </>
    );
}

import { useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Volume1,
  Download,
  Heart,
  Music,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import WaveSurfer from "wavesurfer.js";
import { usePlayerStore } from "../stores/playerStore";
import { api } from "../services/api";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const genreColors: Record<string, string> = {
  electronic: "from-indigo-500 to-violet-600",
  rock: "from-red-500 to-orange-500",
  pop: "from-pink-500 to-rose-400",
  jazz: "from-amber-500 to-yellow-600",
  classical: "from-cyan-600 to-teal-500",
  hiphop: "from-violet-600 to-purple-400",
  "hip-hop": "from-violet-600 to-purple-400",
};

function getGenreGradient(genre?: string): string {
  if (!genre) return "from-primary-500 to-primary-700";
  const key = genre.toLowerCase().replace(/[\s-_]/g, "");
  for (const [k, v] of Object.entries(genreColors)) {
    if (key.includes(k.replace("-", ""))) return v;
  }
  return "from-primary-500 to-primary-700";
}

function VolumeIcon({ volume }: { volume: number }) {
  if (volume === 0) return <VolumeX className="w-4 h-4 text-text-tertiary" />;
  if (volume < 0.5) return <Volume1 className="w-4 h-4 text-text-tertiary" />;
  return <Volume2 className="w-4 h-4 text-text-tertiary" />;
}

export default function Player() {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);

  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    likedIds,
    setIsPlaying,
    setVolume,
    setCurrentTime,
    setDuration,
    stop,
    toggleLike,
  } = usePlayerStore();

  const initWaveSurfer = useCallback(() => {
    if (!waveformRef.current) return;
    if (wsRef.current) {
      wsRef.current.destroy();
    }
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#c4b5fd",
      progressColor: "#7c3aed",
      cursorColor: "#7c3aed",
      barWidth: 2,
      barGap: 1.5,
      barRadius: 2,
      height: 40,
      normalize: true,
    });
    ws.on("ready", () => setDuration(ws.getDuration()));
    ws.on("audioprocess", () =>
      setCurrentTime(ws.getCurrentTime()),
    );
    ws.on("finish", () => setIsPlaying(false));
    ws.setVolume(volume);
    wsRef.current = ws;
    return ws;
  }, [setDuration, setCurrentTime, setIsPlaying, volume]);

  useEffect(() => {
    if (!currentTrack?.audio_path) return;
    const ws = initWaveSurfer();
    if (ws) {
      // api.getAudioUrl extracts basename from full filesystem path
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

  const handleDownload = () => {
    if (!currentTrack?.audio_path) return;
    const url = api.getAudioUrl(currentTrack.audio_path);
    const a = document.createElement("a");
    a.href = url;
    const fileName = currentTrack.title || currentTrack.prompt.slice(0, 30);
    a.download = `${fileName}.wav`;
    a.click();
  };

  if (!currentTrack) return null;

  const liked = likedIds.has(currentTrack.id);
  const gradient = getGenreGradient(currentTrack.genre);
  const hasCover = !!currentTrack.cover_art_path;
  const displayTitle = currentTrack.title || currentTrack.prompt.slice(0, 40);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.15 }}
        className="h-[72px] bg-white border-t border-border
                   flex items-center px-4 gap-3"
      >
        {/* Cover art or genre-colored thumbnail */}
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
            <Music className="w-5 h-5 text-white/90" />
          </div>
        )}

        {/* Track info + heart */}
        <div className="w-40 flex-shrink-0 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {displayTitle}
          </p>
          <p className="text-xs text-text-tertiary mt-0.5 truncate">
            {currentTrack.genre || "Generated"}
          </p>
        </div>

        {/* Heart / like */}
        <button
          onClick={() => toggleLike(currentTrack.id)}
          className="p-1.5 rounded-full hover:bg-surface-tertiary
                     transition-colors cursor-pointer flex-shrink-0"
        >
          <Heart
            className={`w-4 h-4 transition-colors ${
              liked
                ? "fill-red-500 text-red-500"
                : "text-text-tertiary"
            }`}
          />
        </button>

        {/* Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-9 h-9 rounded-full bg-primary-600
                       hover:bg-primary-700 flex items-center
                       justify-center transition-colors
                       cursor-pointer shadow-sm"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-white" />
            ) : (
              <Play className="w-4 h-4 text-white ml-0.5" />
            )}
          </button>
          <button
            onClick={handleStop}
            className="w-8 h-8 rounded-full hover:bg-surface-tertiary
                       flex items-center justify-center
                       transition-colors cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 text-text-secondary" />
          </button>
        </div>

        {/* Time + Waveform */}
        <span className="text-[11px] text-text-tertiary w-9
                         text-right tabular-nums flex-shrink-0">
          {formatTime(currentTime)}
        </span>
        <div ref={waveformRef} className="flex-1 mx-1 min-w-0" />
        <span className="text-[11px] text-text-tertiary w-9
                         tabular-nums flex-shrink-0">
          {formatTime(duration)}
        </span>

        {/* Volume */}
        <div className="flex items-center gap-1.5 w-28 flex-shrink-0">
          <button
            onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
            className="cursor-pointer p-1 rounded
                       hover:bg-surface-tertiary transition-colors"
          >
            <VolumeIcon volume={volume} />
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

        {/* Download */}
        <button
          onClick={handleDownload}
          className="p-2 rounded-lg hover:bg-surface-tertiary
                     transition-colors cursor-pointer flex-shrink-0"
        >
          <Download className="w-4 h-4 text-text-secondary" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

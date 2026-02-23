import { useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Download,
} from "lucide-react";
import WaveSurfer from "wavesurfer.js";
import { usePlayerStore } from "../stores/playerStore";
import { api } from "../services/api";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
    setIsPlaying,
    setVolume,
    setCurrentTime,
    setDuration,
    stop,
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
      height: 48,
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
    a.download = `${currentTrack.prompt.slice(0, 30)}.wav`;
    a.click();
  };

  if (!currentTrack) return null;

  return (
    <div
      className="h-20 bg-white border-t border-border
                 flex items-center px-5 gap-4"
    >
      {/* Track info */}
      <div className="w-44 flex-shrink-0">
        <p className="text-sm font-medium text-text-primary
                      truncate">
          {currentTrack.prompt.slice(0, 40)}
        </p>
        <p className="text-xs text-text-tertiary mt-0.5">
          {currentTrack.genre || "Generated"}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-9 h-9 rounded-full bg-primary-600
                     hover:bg-primary-700 flex items-center
                     justify-center transition-colors
                     cursor-pointer"
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
      <span className="text-xs text-text-tertiary w-10
                       text-right tabular-nums">
        {formatTime(currentTime)}
      </span>
      <div ref={waveformRef} className="flex-1 mx-2" />
      <span className="text-xs text-text-tertiary w-10
                       tabular-nums">
        {formatTime(duration)}
      </span>

      {/* Volume */}
      <div className="flex items-center gap-1.5 w-28">
        <button
          onClick={() => setVolume(volume === 0 ? 0.8 : 0)}
          className="cursor-pointer p-1 rounded
                     hover:bg-surface-tertiary transition-colors"
        >
          {volume === 0 ? (
            <VolumeX className="w-4 h-4 text-text-tertiary" />
          ) : (
            <Volume2 className="w-4 h-4 text-text-tertiary" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="flex-1 h-1 accent-primary-600"
        />
      </div>

      {/* Download */}
      <button
        onClick={handleDownload}
        className="p-2 rounded-lg hover:bg-surface-tertiary
                   transition-colors cursor-pointer"
      >
        <Download className="w-4 h-4 text-text-secondary" />
      </button>
    </div>
  );
}
import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Clock, GitBranch, Image, Loader2, Music, Play, Repeat, Shuffle, Star, Trash2,} from "lucide-react";
import {motion} from "framer-motion";
import type {Generation} from "../../types";
import {api} from "../../services/api";
import {formatDate, formatSeconds, getGradient} from "../../utils/format";

interface GridCardProps {
    gen: Generation;
    isCurrentTrack: boolean;
    isPlaying: boolean;
    onPlay: () => void;
    onToggleLike: () => void;
    onDelete: () => void;
    onExtend: () => void;
    onRemix: () => void;
    onRegenCover: () => void;
    onOpenDetail: () => void;
}

export default function GridCard({
                                     gen,
                                     isCurrentTrack,
                                     isPlaying,
                                     onPlay,
                                     onToggleLike,
                                     onDelete,
                                     onExtend,
                                     onRemix,
                                     onRegenCover,
                                     onOpenDetail,
                                 }: GridCardProps) {
    const {t} = useTranslation();
    const gradient = getGradient(gen.genre);
    const hasCover = !!gen.cover_art_path;
    const displayTitle = gen.title || gen.prompt.slice(0, 50);
    const [coverLoading, setCoverLoading] = useState(false);

    const handleRegenCover = async () => {
        setCoverLoading(true);
        await onRegenCover();
        setCoverLoading(false);
    };

    return (
        <motion.div
            initial={{opacity: 0, y: 12}}
            animate={{opacity: 1, y: 0}}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden
                  hover:shadow-md transition-shadow group
                  ${isCurrentTrack ? "border-primary-300 ring-1 ring-primary-200" : "border-border"}`}
        >
            {/* Cover */}
            <div
                className={`h-32 ${hasCover ? "" : `bg-gradient-to-br ${gradient}`}
                    flex items-center justify-center relative overflow-hidden`}
            >
                {hasCover ? (
                    <img
                        src={api.getCoverArtUrl(gen.cover_art_path!)}
                        alt="Cover"
                        className={`w-full h-full object-cover transition-opacity
                       ${coverLoading ? "opacity-40" : ""}`}
                    />
                ) : gen.status === "completed" ? (
                    <div className="flex flex-col items-center gap-1.5">
                        <Loader2 className="w-5 h-5 text-white/40 animate-spin"/>
                        <span className="text-[10px] text-white/40 font-medium">
                            {t("library.generatingCover", "Generating cover...")}
                        </span>
                    </div>
                ) : (
                    <Music className="w-8 h-8 text-white/20"/>
                )}
                {coverLoading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-white"/>
                    </div>
                )}

                {/* Play overlay */}
                <button
                    onClick={onPlay}
                    disabled={gen.status !== "completed"}
                    className="absolute inset-0 flex items-center justify-center
                     bg-black/0 group-hover:bg-black/25
                     transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                    <div
                        className={`w-11 h-11 rounded-full bg-white/95 backdrop-blur-sm
                       flex items-center justify-center shadow-lg
                       transition-[transform,opacity] will-change-transform
                       ${isCurrentTrack && isPlaying
                            ? "opacity-100 scale-100"
                            : "opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100"
                        }`}
                    >
                        {isCurrentTrack && isPlaying ? (
                            <div className="flex items-center gap-[3px]">
                                {[0, 1, 2].map((i) => (
                                    <motion.div
                                        key={i}
                                        className="w-[3px] rounded-full bg-primary-600"
                                        animate={{height: [6, 14, 6]}}
                                        transition={{
                                            duration: 0.6,
                                            repeat: Infinity,
                                            delay: i * 0.15,
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <Play className="w-5 h-5 text-primary-600 ml-0.5"/>
                        )}
                    </div>
                </button>

                {/* Star/like */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleLike();
                    }}
                    className="absolute top-2.5 right-2.5 p-1.5 rounded-full backdrop-blur-sm
                     bg-black/10 hover:bg-black/20 transition-colors cursor-pointer"
                >
                    <Star
                        className={`w-3.5 h-3.5 transition-colors
                       ${gen.is_liked
                            ? "fill-amber-400 text-amber-400"
                            : "text-white/80 hover:text-white"
                        }`}
                    />
                </button>

                {/* Status badge (only if not completed) */}
                {gen.status !== "completed" && (
                    <span
                        className={`absolute top-2.5 left-2.5 text-[10px] px-2 py-0.5
                        rounded-full font-semibold backdrop-blur-sm
                        ${gen.status === "failed"
                            ? "bg-red-500/30 text-white"
                            : "bg-amber-500/30 text-white"
                        }`}
                    >
            {t(`library.${gen.status}`)}
          </span>
                )}
            </div>

            {/* Body */}
            <div className="p-4 cursor-pointer" onClick={onOpenDetail}>
                <p className="text-[13px] font-semibold text-text-primary truncate mb-1 leading-tight">
                    {displayTitle}
                </p>

                {gen.parent_id && gen.parent_type && (
                    <p className="text-[10px] text-text-tertiary flex items-center gap-1 mb-2">
                        <GitBranch className="w-2.5 h-2.5"/>
                        {gen.parent_type === "extend" ? t("library.extended") : t("library.remixed")}
                    </p>
                )}

                <div className="flex items-center gap-1.5 flex-wrap mb-3">
                    {gen.genre && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full
                             bg-primary-50 text-primary-600 font-medium">
              {gen.genre}
            </span>
                    )}
                    {gen.mood && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full
                             bg-accent-50 text-accent-500 font-medium">
              {gen.mood}
            </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-text-tertiary ml-auto tabular-nums">
            <Clock className="w-3 h-3"/>
                        {formatSeconds(gen.actual_duration)}
          </span>
                </div>

                <div className="flex items-center justify-between">
          <span className="text-[11px] text-text-tertiary">
            {formatDate(gen.created_at)}
          </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={onExtend}
                            title={t("library.extend")}
                            className="p-1.5 rounded-lg hover:bg-primary-50 transition-colors cursor-pointer"
                        >
                            <Repeat className="w-3.5 h-3.5 text-text-tertiary hover:text-primary-600"/>
                        </button>
                        <button
                            onClick={onRemix}
                            title={t("library.remix")}
                            className="p-1.5 rounded-lg hover:bg-accent-50 transition-colors cursor-pointer"
                        >
                            <Shuffle className="w-3.5 h-3.5 text-text-tertiary hover:text-accent-500"/>
                        </button>
                        <button
                            onClick={handleRegenCover}
                            title={t("library.regenCover")}
                            className="p-1.5 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                            <Image className="w-3.5 h-3.5 text-text-tertiary hover:text-blue-500"/>
                        </button>
                        <button
                            onClick={onDelete}
                            title={t("library.delete")}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5 text-text-tertiary hover:text-red-500"/>
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

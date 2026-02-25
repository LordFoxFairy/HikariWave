import {useState} from "react";
import {useTranslation} from "react-i18next";
import {GitBranch, Image, Music, Play, Repeat, Shuffle, Star, Trash2,} from "lucide-react";
import {motion} from "framer-motion";
import type {Generation} from "../../types";
import {api} from "../../services/api";
import {formatDate, formatSeconds, getGradient} from "../../utils/format";

interface ListRowProps {
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

export default function ListRow({
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
                                }: ListRowProps) {
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
        <div
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors
                  group hover:bg-surface-secondary cursor-pointer
                  ${isCurrentTrack ? "bg-primary-50/50" : ""}`}
            onClick={gen.status === "completed" ? onOpenDetail : undefined}
        >
            {/* Thumbnail */}
            <div
                className={`w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden relative
                    ${hasCover ? "" : `bg-gradient-to-br ${gradient}`}
                    flex items-center justify-center`}
            >
                {hasCover ? (
                    <img
                        src={api.getCoverArtUrl(gen.cover_art_path!)}
                        alt=""
                        className={`w-full h-full object-cover ${coverLoading ? "opacity-40" : ""}`}
                    />
                ) : (
                    <Music className="w-4 h-4 text-white/30"/>
                )}
                {/* Mini play indicator */}
                {isCurrentTrack && isPlaying && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                        <div className="flex items-center gap-[2px]">
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-[2px] rounded-full bg-white"
                                    animate={{height: [4, 10, 4]}}
                                    transition={{
                                        duration: 0.6,
                                        repeat: Infinity,
                                        delay: i * 0.15,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}
                {gen.status === "completed" && !isCurrentTrack && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onPlay(); }}
                        className="absolute inset-0 flex items-center justify-center
                                 bg-black/0 hover:bg-black/30 transition-colors rounded-lg cursor-pointer"
                    >
                        <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity"/>
                    </button>
                )}
            </div>

            {/* Title + lineage */}
            <div className="flex-1 min-w-0">
                <p
                    className={`text-sm font-medium truncate leading-tight
                     ${isCurrentTrack ? "text-primary-700" : "text-text-primary"}`}
                >
                    {displayTitle}
                </p>
                {gen.parent_type && (
                    <p className="text-[10px] text-text-tertiary flex items-center gap-1 mt-0.5">
                        <GitBranch className="w-2.5 h-2.5"/>
                        {gen.parent_type === "extend" ? t("library.extended") : t("library.remixed")}
                    </p>
                )}
            </div>

            {/* Genre */}
            <span className="w-24 text-center">
        {gen.genre ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full
                           bg-primary-50 text-primary-600 font-medium">
            {gen.genre}
          </span>
        ) : (
            <span className="text-[11px] text-text-tertiary">--</span>
        )}
      </span>

            {/* Mood */}
            <span className="w-20 text-center">
        {gen.mood ? (
            <span className="text-[11px] px-2 py-0.5 rounded-full
                           bg-accent-50 text-accent-500 font-medium">
            {gen.mood}
          </span>
        ) : (
            <span className="text-[11px] text-text-tertiary">--</span>
        )}
      </span>

            {/* Duration */}
            <span className="w-16 text-center text-[12px] text-text-tertiary tabular-nums">
        {formatSeconds(gen.actual_duration)}
      </span>

            {/* Date */}
            <span className="w-24 text-center text-[11px] text-text-tertiary">
        {formatDate(gen.created_at)}
      </span>

            {/* Actions */}
            <div
                className="w-20 flex items-center justify-end gap-0.5
                    opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onToggleLike}
                    className="p-1 rounded-md hover:bg-amber-50 transition-colors cursor-pointer"
                    title={gen.is_liked ? t("library.unfavorite") : t("library.favorite")}
                >
                    <Star
                        className={`w-3.5 h-3.5 ${gen.is_liked
                            ? "fill-amber-400 text-amber-400"
                            : "text-text-tertiary hover:text-amber-500"
                        }`}
                    />
                </button>
                <button
                    onClick={onExtend}
                    title={t("library.extend")}
                    className="p-1 rounded-md hover:bg-primary-50 transition-colors cursor-pointer"
                >
                    <Repeat className="w-3.5 h-3.5 text-text-tertiary hover:text-primary-600"/>
                </button>
                <button
                    onClick={onRemix}
                    title={t("library.remix")}
                    className="p-1 rounded-md hover:bg-accent-50 transition-colors cursor-pointer"
                >
                    <Shuffle className="w-3.5 h-3.5 text-text-tertiary hover:text-accent-500"/>
                </button>
                <button
                    onClick={handleRegenCover}
                    title={t("library.regenCover")}
                    className="p-1 rounded-md hover:bg-blue-50 transition-colors cursor-pointer"
                >
                    <Image className="w-3.5 h-3.5 text-text-tertiary hover:text-blue-500"/>
                </button>
                <button
                    onClick={onDelete}
                    title={t("library.delete")}
                    className="p-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
                >
                    <Trash2 className="w-3.5 h-3.5 text-text-tertiary hover:text-red-500"/>
                </button>
            </div>
        </div>
    );
}

import {Music, Sparkles, Star, X} from "lucide-react";
import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";

interface EmptyStateProps {
    hasFilters: boolean;
    isLikedFilter: boolean;
    onClearFilters: () => void;
    onGoCreate: () => void;
}

export default function EmptyState({
                                       hasFilters,
                                       isLikedFilter,
                                       onClearFilters,
                                       onGoCreate,
                                   }: EmptyStateProps) {
    const {t} = useTranslation();
    return (
        <motion.div
            initial={{opacity: 0, y: 12}}
            animate={{opacity: 1, y: 0}}
            className="text-center py-20"
        >
            <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center
                    mx-auto mb-4 border ${
                    isLikedFilter
                        ? "bg-amber-50 border-amber-100"
                        : hasFilters
                            ? "bg-surface-secondary border-border"
                            : "bg-primary-50 border-primary-100"
                }`}
            >
                {isLikedFilter ? (
                    <Star className="w-7 h-7 text-amber-400"/>
                ) : (
                    <Music className="w-7 h-7 text-primary-400"/>
                )}
            </div>
            <p className="text-text-primary font-semibold mb-1">
                {isLikedFilter
                    ? t("library.noFavoritesYet")
                    : hasFilters
                        ? t("library.noMatchingTracks")
                        : t("library.noTracksYet")}
            </p>
            <p className="text-text-tertiary text-[13px] mb-5 max-w-xs mx-auto">
                {isLikedFilter
                    ? t("library.starSongsHint")
                    : hasFilters
                        ? t("library.adjustFilters")
                        : t("library.createFirstSong")}
            </p>
            {hasFilters ? (
                <button
                    onClick={onClearFilters}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                     bg-white border border-border text-sm font-medium
                     text-text-secondary hover:bg-surface-secondary
                     transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4"/>
                    {t("library.clearFilters")}
                </button>
            ) : (
                <button
                    onClick={onGoCreate}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                     bg-primary-600 text-white text-sm font-medium
                     hover:bg-primary-700 transition-colors cursor-pointer shadow-sm"
                >
                    <Sparkles className="w-4 h-4"/>
                    {t("library.createMusic")}
                </button>
            )}
        </motion.div>
    );
}

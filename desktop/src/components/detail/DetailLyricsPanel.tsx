import {useMemo} from "react";
import {FileText} from "lucide-react";
import {useTranslation} from "react-i18next";
import {parseLyrics, parseLRC, findActiveLRCIndex} from "../../utils/lyrics";

interface DetailLyricsPanelProps {
    lyrics: string | undefined;
    lrcLyrics?: string;
    currentTime: number;
    duration: number;
    isCurrentTrack: boolean;
}

export default function DetailLyricsPanel({
    lyrics,
    lrcLyrics,
    currentTime,
    duration,
    isCurrentTrack,
}: DetailLyricsPanelProps) {
    const {t} = useTranslation();

    // Parse LRC if available
    const lrcLines = useMemo(() => {
        if (!lrcLyrics) return [];
        return parseLRC(lrcLyrics);
    }, [lrcLyrics]);

    const useLRC = lrcLines.length > 0;

    // Section-based parsing (fallback)
    const sections = useMemo(() => {
        if (useLRC || !lyrics) return [];
        return parseLyrics(lyrics);
    }, [lyrics, useLRC]);

    // Active index for LRC mode
    const activeLRCIndex = useMemo(() => {
        if (!useLRC || !isCurrentTrack) return -1;
        return findActiveLRCIndex(lrcLines, currentTime);
    }, [useLRC, lrcLines, currentTime, isCurrentTrack]);

    // Active index for section mode (fallback)
    const activeSectionIndex = useMemo(() => {
        if (useLRC || !isCurrentTrack || sections.length === 0 || duration <= 0) return -1;
        const progress = currentTime / duration;
        const idx = Math.floor(progress * sections.length);
        return Math.min(idx, sections.length - 1);
    }, [useLRC, sections, currentTime, duration, isCurrentTrack]);

    if (!lyrics && !lrcLyrics) {
        return (
            <div className="flex items-center justify-center py-16 text-[13px] text-text-tertiary">
                <FileText className="w-4 h-4 mr-2 opacity-40"/>
                {t("detail.noLyrics")}
            </div>
        );
    }

    // LRC mode — line-by-line sync
    if (useLRC) {
        return (
            <div className="space-y-2">
                {lrcLines.map((line, i) => {
                    const isActive = activeLRCIndex === i;
                    return (
                        <div
                            key={i}
                            className={`pl-4 transition-all duration-500 ${
                                isActive
                                    ? "border-l-2 border-primary-500 opacity-100"
                                    : isCurrentTrack
                                        ? "border-l-2 border-transparent opacity-35"
                                        : "border-l-2 border-transparent opacity-100"
                            }`}
                        >
                            <p className={`text-[15px] leading-[1.9] ${
                                isActive ? "text-text-primary font-medium" : "text-text-secondary"
                            }`}>
                                {line.text}
                            </p>
                        </div>
                    );
                })}
            </div>
        );
    }

    // Fallback: section-based sync
    return (
        <div className="space-y-4">
            {sections.map((section) => {
                const isActive = activeSectionIndex === section.index;
                return (
                    <div
                        key={section.index}
                        className={`pl-4 transition-all duration-500 ${
                            isActive
                                ? "border-l-2 border-primary-500 opacity-100"
                                : isCurrentTrack
                                    ? "border-l-2 border-transparent opacity-35"
                                    : "border-l-2 border-transparent opacity-100"
                        }`}
                    >
                        {section.tag && (
                            <span className={`inline-block text-[11px] font-bold uppercase tracking-[0.1em] mb-1.5
                                ${isActive ? "text-primary-500" : "text-text-tertiary"}`}>
                                {section.tag}
                            </span>
                        )}
                        {section.lines.map((line, li) => (
                            <p
                                key={li}
                                className={`text-[15px] leading-[1.9] ${
                                    line.trim()
                                        ? isActive ? "text-text-primary font-medium" : "text-text-secondary"
                                        : "h-3"
                                }`}
                            >
                                {line}
                            </p>
                        ))}
                    </div>
                );
            })}
        </div>
    );
}

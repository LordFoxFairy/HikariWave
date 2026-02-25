import {useEffect, useMemo, useRef} from "react";
import {FileText} from "lucide-react";
import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";
import {parseLyrics, parseLRC, findActiveLRCIndex} from "../utils/lyrics";

interface LyricsPanelProps {
    lyrics: string | undefined;
    lrcLyrics?: string;
    currentTime: number;
    duration: number;
}

export default function LyricsPanel({
    lyrics,
    lrcLyrics,
    currentTime,
    duration,
}: LyricsPanelProps) {
    const {t} = useTranslation();
    const scrollRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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
        if (!useLRC) return -1;
        return findActiveLRCIndex(lrcLines, currentTime);
    }, [useLRC, lrcLines, currentTime]);

    // Active index for section mode (fallback)
    const activeSectionIndex = useMemo(() => {
        if (useLRC || sections.length === 0 || duration <= 0) return -1;
        const progress = currentTime / duration;
        const idx = Math.floor(progress * sections.length);
        return Math.min(idx, sections.length - 1);
    }, [useLRC, sections, currentTime, duration]);

    // Auto-scroll to active line/section
    useEffect(() => {
        const activeIdx = useLRC ? activeLRCIndex : activeSectionIndex;
        if (activeIdx < 0) return;
        const el = lineRefs.current.get(activeIdx);
        if (el && scrollRef.current) {
            el.scrollIntoView({behavior: "smooth", block: "center"});
        }
    }, [useLRC, activeLRCIndex, activeSectionIndex]);

    if (!lyrics && !lrcLyrics) {
        return (
            <div className="flex items-center justify-center py-10 text-[13px] text-text-tertiary">
                <FileText className="w-4 h-4 mr-2 opacity-40"/>
                {t("player.noLyricsAvailable")}
            </div>
        );
    }

    // LRC mode — line-by-line sync
    if (useLRC) {
        return (
            <div
                ref={scrollRef}
                className="overflow-y-auto max-h-72 px-6 py-4 lyrics-scroll bg-surface-secondary/50"
            >
                <div className="max-w-md mx-auto space-y-2">
                    {lrcLines.map((line, i) => {
                        const isActive = activeLRCIndex === i;
                        return (
                            <motion.div
                                key={i}
                                ref={(el) => {
                                    if (el) lineRefs.current.set(i, el);
                                }}
                                animate={{opacity: isActive ? 1 : 0.35}}
                                transition={{duration: 0.3, ease: "easeOut"}}
                            >
                                <p className={`text-[13px] leading-[1.8] transition-all duration-300 ${
                                    isActive
                                        ? "text-text-primary font-semibold scale-105 origin-left"
                                        : "text-text-secondary"
                                }`}>
                                    {line.text}
                                </p>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // Fallback: section-based sync (existing behavior)
    return (
        <div
            ref={scrollRef}
            className="overflow-y-auto max-h-72 px-6 py-4 lyrics-scroll bg-surface-secondary/50"
        >
            <div className="max-w-md mx-auto">
                {sections.map((section) => {
                    const isActive = activeSectionIndex === section.index;
                    return (
                        <motion.div
                            key={section.index}
                            ref={(el) => {
                                if (el) lineRefs.current.set(section.index, el);
                            }}
                            animate={{opacity: isActive ? 1 : 0.35}}
                            transition={{duration: 0.5, ease: "easeOut"}}
                            className="mb-4 last:mb-0"
                        >
                            {section.tag && (
                                <span className={`inline-block text-[10px] font-bold uppercase tracking-[0.1em] mb-1.5
                                    ${isActive ? "text-primary-500" : "text-text-tertiary"}`}>
                                    {section.tag}
                                </span>
                            )}
                            {section.lines.map((line, li) => (
                                <p
                                    key={li}
                                    className={`text-[13px] leading-[1.8] ${
                                        line.trim()
                                            ? isActive ? "text-text-primary font-medium" : "text-text-secondary"
                                            : "h-3"
                                    }`}
                                >
                                    {line}
                                </p>
                            ))}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

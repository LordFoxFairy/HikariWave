import {useEffect, useMemo, useRef} from "react";
import {FileText} from "lucide-react";
import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";

interface LyricSection {
    tag: string;
    lines: string[];
    index: number;
}

function parseLyrics(lyrics: string): LyricSection[] {
    const sections: LyricSection[] = [];
    let currentTag = "";
    let currentLines: string[] = [];
    let sectionIndex = 0;

    for (const line of lyrics.split("\n")) {
        const tagMatch = line.match(/^\[(.+)\]$/);
        if (tagMatch) {
            if (currentLines.length > 0 || currentTag) {
                sections.push({
                    tag: currentTag,
                    lines: currentLines,
                    index: sectionIndex++,
                });
            }
            currentTag = tagMatch[1];
            currentLines = [];
        } else {
            currentLines.push(line);
        }
    }
    if (currentLines.length > 0 || currentTag) {
        sections.push({
            tag: currentTag,
            lines: currentLines,
            index: sectionIndex,
        });
    }
    return sections;
}

interface LyricsPanelProps {
    lyrics: string | undefined;
    currentTime: number;
    duration: number;
}

export default function LyricsPanel({
                                        lyrics,
                                        currentTime,
                                        duration,
                                    }: LyricsPanelProps) {
    const {t} = useTranslation();
    const scrollRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    const sections = useMemo(() => {
        if (!lyrics) return [];
        return parseLyrics(lyrics);
    }, [lyrics]);

    const activeSectionIndex = useMemo(() => {
        if (sections.length === 0 || duration <= 0) return -1;
        const progress = currentTime / duration;
        const idx = Math.floor(progress * sections.length);
        return Math.min(idx, sections.length - 1);
    }, [sections, currentTime, duration]);

    useEffect(() => {
        if (activeSectionIndex < 0) return;
        const el = sectionRefs.current.get(activeSectionIndex);
        if (el && scrollRef.current) {
            el.scrollIntoView({behavior: "smooth", block: "center"});
        }
    }, [activeSectionIndex]);

    if (!lyrics) {
        return (
            <div className="flex items-center justify-center py-10 text-[13px] text-text-tertiary">
                <FileText className="w-4 h-4 mr-2 opacity-40"/>
                {t("player.noLyricsAvailable")}
            </div>
        );
    }

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
                                if (el) sectionRefs.current.set(section.index, el);
                            }}
                            animate={{
                                opacity: isActive ? 1 : 0.35,
                            }}
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

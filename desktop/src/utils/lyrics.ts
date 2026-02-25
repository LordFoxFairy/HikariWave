export interface LyricSection {
    tag: string;
    lines: string[];
    index: number;
}

export function parseLyrics(lyrics: string): LyricSection[] {
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

export interface TimedLyricLine {
    time: number;  // seconds
    text: string;
}

/** Pattern matching structural section markers that should not be displayed as lyrics. */
const SECTION_PATTERN = /^\[?(Intro|Verse\s*\d*|Pre-?Chorus|Chorus|Bridge|Outro|Instrumental\s*Break|前奏|主歌|副歌前?|预副歌|导歌|桥段|过桥|过渡|间奏|尾声|结尾|尾奏|第[一二三]段)\s*\d?\]?\s*$/i;

export function parseLRC(lrc: string): TimedLyricLine[] {
    const lines: TimedLyricLine[] = [];
    for (const raw of lrc.split("\n")) {
        const match = raw.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)$/);
        if (match) {
            const minutes = parseInt(match[1], 10);
            const seconds = parseInt(match[2], 10);
            const ms = match[3].length === 2
                ? parseInt(match[3], 10) * 10
                : parseInt(match[3], 10);
            const time = minutes * 60 + seconds + ms / 1000;
            const text = match[4].trim();
            if (text && !SECTION_PATTERN.test(text)) {
                lines.push({ time, text });
            }
        }
    }
    return lines;
}

/**
 * Find the index of the active timed lyric line based on current playback time.
 */
export function findActiveLRCIndex(lines: TimedLyricLine[], currentTime: number): number {
    if (lines.length === 0) return -1;
    // Find the last line whose time <= currentTime
    let active = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= currentTime) {
            active = i;
        } else {
            break;
        }
    }
    return active;
}

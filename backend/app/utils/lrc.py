"""LRC format utilities — no service/provider dependencies."""

import re

LRC_LINE_RE = re.compile(r"\[(\d{2}):(\d{2})\.(\d{2,3})\](.+)")


def lrc_to_plain(lrc: str) -> str:
    """Strip LRC timestamps to produce plain-text lyrics with section structure.

    ``[00:12.50]some lyric`` -> ``some lyric``
    Also re-inserts blank lines at large time gaps (>6s) to visually separate sections.
    """
    lines: list[str] = []
    prev_seconds = 0.0
    for raw in lrc.splitlines():
        raw = raw.strip()
        m = LRC_LINE_RE.match(raw)
        if not m:
            continue
        mins, secs, cs, text = m.groups()
        cur_seconds = int(mins) * 60 + int(secs) + int(cs.ljust(3, "0")) / 1000
        if lines and (cur_seconds - prev_seconds) > 6.0:
            lines.append("")
        lines.append(text)
        prev_seconds = cur_seconds
    return "\n".join(lines)

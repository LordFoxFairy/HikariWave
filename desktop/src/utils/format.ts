export const genreGradients: Record<string, string> = {
    electronic: "from-indigo-500 to-violet-600",
    rock: "from-red-500 to-orange-500",
    pop: "from-pink-500 to-rose-400",
    jazz: "from-amber-500 to-yellow-600",
    classical: "from-cyan-600 to-teal-500",
    hiphop: "from-violet-600 to-purple-400",
    "hip-hop": "from-violet-600 to-purple-400",
    lofi: "from-teal-500 to-emerald-400",
    ambient: "from-sky-500 to-blue-400",
    metal: "from-zinc-600 to-gray-500",
    indie: "from-slate-500 to-gray-400",
    "r&b": "from-purple-500 to-pink-400",
};

export function getGradient(genre?: string): string {
    if (!genre) return "from-primary-500 to-primary-700";
    const key = genre.toLowerCase().replace(/[\s-_]/g, "");
    for (const [k, v] of Object.entries(genreGradients)) {
        if (key.includes(k.replace("-", ""))) return v;
    }
    return "from-primary-500 to-primary-700";
}

export function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function formatSeconds(sec?: number): string {
    if (sec == null) return "--";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

/* -- Song structure tags for the lyrics toolbar -- */
export const STRUCTURE_TAGS = [
    "Intro",
    "Verse",
    "Pre-Chorus",
    "Chorus",
    "Bridge",
    "Outro",
    "Instrumental Break",
];

/* -- Genre color map -- */
export const genreColors: Record<string, string> = {
    Pop: "bg-pink-50 text-pink-700 border-pink-200",
    Rock: "bg-red-50 text-red-700 border-red-200",
    Jazz: "bg-amber-50 text-amber-700 border-amber-200",
    Electronic: "bg-cyan-50 text-cyan-700 border-cyan-200",
    "Hip-Hop": "bg-violet-50 text-violet-700 border-violet-200",
    "R&B": "bg-purple-50 text-purple-700 border-purple-200",
    Classical: "bg-stone-50 text-stone-700 border-stone-200",
    Country: "bg-orange-50 text-orange-700 border-orange-200",
    Folk: "bg-lime-50 text-lime-700 border-lime-200",
    "Lo-fi": "bg-teal-50 text-teal-700 border-teal-200",
    Ambient: "bg-sky-50 text-sky-700 border-sky-200",
    Latin: "bg-rose-50 text-rose-700 border-rose-200",
    "K-Pop": "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    "J-Pop": "bg-indigo-50 text-indigo-700 border-indigo-200",
    Metal: "bg-zinc-100 text-zinc-700 border-zinc-300",
    Blues: "bg-blue-50 text-blue-700 border-blue-200",
    Reggae: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Soul: "bg-yellow-50 text-yellow-700 border-yellow-200",
    Funk: "bg-orange-50 text-orange-700 border-orange-200",
    Indie: "bg-slate-50 text-slate-700 border-slate-200",
};

export const moodGradients: Record<string, string> = {
    Happy: "from-yellow-100 to-amber-50 text-amber-700 border-amber-200",
    Sad: "from-blue-100 to-indigo-50 text-indigo-700 border-indigo-200",
    Energetic: "from-red-100 to-orange-50 text-orange-700 border-orange-200",
    Calm: "from-sky-100 to-cyan-50 text-cyan-700 border-cyan-200",
    Romantic: "from-pink-100 to-rose-50 text-rose-700 border-rose-200",
    Dark: "from-gray-200 to-zinc-100 text-zinc-700 border-zinc-300",
    Nostalgic: "from-amber-100 to-yellow-50 text-yellow-700 border-yellow-200",
    Dreamy: "from-purple-100 to-violet-50 text-violet-700 border-violet-200",
    Epic: "from-indigo-100 to-blue-50 text-blue-700 border-blue-200",
    Chill: "from-teal-100 to-emerald-50 text-emerald-700 border-emerald-200",
    Melancholy: "from-slate-100 to-gray-50 text-gray-700 border-gray-200",
    Uplifting: "from-lime-100 to-green-50 text-green-700 border-green-200",
};

/* Pre-computed random values for waveform animation to avoid jitter on re-render */
export const WAVEFORM_RANDOMS = Array.from({length: 24}, () => ({
    height: 20 + Math.random() * 36,
    duration: 0.8 + Math.random() * 0.5,
}));

/* -- Section animation -- */
export const sectionVariants = {
    hidden: {opacity: 0, y: 16},
    visible: {opacity: 1, y: 0},
};


export interface MusicTemplate {
    id: string;
    nameKey: string;
    descKey: string;
    prompt: string;
    genre: string[];
    mood: string[];
    language: string;
    instrumental: boolean;
    icon: string;
    gradient: string;
}

export const MUSIC_TEMPLATES: MusicTemplate[] = [
    {
        id: "gufeng",
        nameKey: "templates.gufeng",
        descKey: "templates.gufengDesc",
        prompt: "一首古风中国风歌曲，融合古筝、琵琶与竹笛，诗词般的歌词，讲述江南烟雨中的离愁别绪，空灵婉转的女声演唱",
        genre: ["Folk", "Classical"],
        mood: ["Nostalgic", "Dreamy"],
        language: "Chinese",
        instrumental: false,
        icon: "🏯",
        gradient: "from-amber-500 to-red-600",
    },
    {
        id: "liuxing",
        nameKey: "templates.liuxing",
        descKey: "templates.liuxingDesc",
        prompt: "一首现代华语流行情歌，钢琴伴奏配弦乐编曲，温暖深情的旋律，讲述初恋的甜蜜与心动，适合男生演唱的温柔嗓音",
        genre: ["Pop"],
        mood: ["Romantic", "Happy"],
        language: "Chinese",
        instrumental: false,
        icon: "🎤",
        gradient: "from-pink-500 to-purple-600",
    },
    {
        id: "duichang",
        nameKey: "templates.duichang",
        descKey: "templates.duichangDesc",
        prompt: "一首男女对唱情歌，中文流行风格，男声深沉温暖女声清澈甜美，钢琴与吉他伴奏，讲述两个人从相遇到相爱的故事，副歌部分男女声交织",
        genre: ["Pop", "R&B"],
        mood: ["Romantic", "Uplifting"],
        language: "Chinese",
        instrumental: false,
        icon: "💑",
        gradient: "from-rose-500 to-indigo-600",
    },
    {
        id: "hechang",
        nameKey: "templates.hechang",
        descKey: "templates.hechangDesc",
        prompt: "一首多人合唱的中文歌曲，青春励志主题，充满力量感的编曲，鼓点有力配合管弦乐，多声部和声交织，适合毕业季或团队凝聚的场景，副歌大气磅礴",
        genre: ["Pop", "Rock"],
        mood: ["Energetic", "Epic"],
        language: "Chinese",
        instrumental: false,
        icon: "🎶",
        gradient: "from-blue-500 to-emerald-500",
    },
];

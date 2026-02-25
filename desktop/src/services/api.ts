import type {
    CachedModelInfo,
    CoverArtRequest,
    CoverArtResponse,
    DownloadProgress,
    ExtendRequest,
    GenerateLyricsRequest,
    GenerateLyricsResponse,
    GenerateMusicRequest,
    Generation,
    HFSearchResponse,
    LLMConfig,
    LLMTestRequest,
    LLMTestResponse,
    MusicProviderConfig,
    MusicProviderListResponse,
    RemixRequest,
    StyleSuggestion,
    StyleSuggestRequest,
    TitleGenerateRequest,
} from "../types";

const DEFAULT_BASE_URL = "http://127.0.0.1:23456/api/v1";

let baseUrl = DEFAULT_BASE_URL;

export function setBaseUrl(url: string) {
    baseUrl = url.replace(/\/+$/, "");
}

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers,
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
    }
    if (res.status === 204 || res.headers.get("content-length") === "0") {
        return null as T;
    }
    return res.json();
}

export const api = {
    generateMusic(data: GenerateMusicRequest) {
        return request<{ task_id: string; status: string }>("/generate/music", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    generateLyrics(data: GenerateLyricsRequest) {
        return request<GenerateLyricsResponse>("/generate/lyrics", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    async suggestStyle(data: StyleSuggestRequest) {
        const res = await request<{ suggestions: StyleSuggestion }>("/generate/suggest-style", {
            method: "POST",
            body: JSON.stringify(data),
        });
        return res.suggestions;
    },

    generateTitle(data: TitleGenerateRequest) {
        return request<{ title: string }>("/generate/title", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    async getTaskStatus(taskId: string) {
        // Backend returns a full GenerationResponse from /tasks/{taskId}
        const gen = await request<Generation>(`/tasks/${taskId}`);
        return gen;
    },

    cancelTask(taskId: string) {
        return request<{ detail: string }>(`/tasks/${taskId}/cancel`, {
            method: "POST",
        });
    },

    async getGenerations(params?: {
        offset?: number;
        limit?: number;
        search?: string;
        is_liked?: boolean;
        genre?: string;
        mood?: string;
        status?: string;
        sort?: string;
        sort_dir?: string;
    }) {
        const qs = new URLSearchParams();
        if (params?.offset !== undefined) qs.set("offset", String(params.offset));
        if (params?.limit !== undefined) qs.set("limit", String(params.limit));
        if (params?.search) qs.set("search", params.search);
        if (params?.is_liked !== undefined) qs.set("is_liked", String(params.is_liked));
        if (params?.genre) qs.set("genre", params.genre);
        if (params?.mood) qs.set("mood", params.mood);
        if (params?.status) qs.set("status", params.status);
        if (params?.sort) qs.set("sort", params.sort);
        if (params?.sort_dir) qs.set("sort_dir", params.sort_dir);
        const query = qs.toString();
        const data = await request<{ items: Generation[]; total: number }>(
            `/generations${query ? `?${query}` : ""}`,
        );
        return data;
    },

    deleteGeneration(id: number) {
        return request<void>(`/generations/${id}`, {method: "DELETE"});
    },

    getGeneration(id: number) {
        return request<Generation>(`/generations/${id}`);
    },

    getAudioUrl(audioPath: string) {
        return `${baseUrl}/audio/${encodeURIComponent(audioPath)}`;
    },

    getCoverArtUrl(coverPath: string) {
        return `${baseUrl}/covers/${encodeURIComponent(coverPath)}`;
    },

    getLyricsUrl(audioPath: string) {
        const stem = audioPath.replace(/\.[^.]+$/, "");
        return `${baseUrl}/lyrics/${encodeURIComponent(stem + ".txt")}`;
    },

    getLrcUrl(audioPath: string) {
        const stem = audioPath.replace(/\.[^.]+$/, "");
        return `${baseUrl}/lyrics/${encodeURIComponent(stem + ".lrc")}`;
    },

    extendSong(data: ExtendRequest) {
        return request<{ task_id: string; status: string }>("/generate/extend", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    remixSong(data: RemixRequest) {
        return request<{ task_id: string; status: string }>("/generate/remix", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    toggleLike(id: number) {
        return request<{ is_liked: boolean }>(`/generations/${id}/toggle-like`, {
            method: "POST",
        });
    },

    regenerateCover(data: CoverArtRequest) {
        return request<CoverArtResponse>("/generate/cover-art", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    healthCheck() {
        return request<{ status: string }>("/health");
    },

    // ---- LLM config management ----

    getLLMConfig() {
        return request<LLMConfig>("/providers/llm/config");
    },

    updateLLMConfig(data: LLMConfig) {
        return request<LLMConfig>("/providers/llm/config", {
            method: "PUT",
            body: JSON.stringify(data),
        });
    },

    testLLMConnection(data: LLMTestRequest) {
        return request<LLMTestResponse>("/providers/llm/test", {
            method: "POST",
            body: JSON.stringify(data),
        });
    },

    // ---- Music config management ----

    getMusicConfig() {
        return request<MusicProviderConfig>("/providers/music/config");
    },

    updateMusicConfig(data: MusicProviderConfig) {
        return request<MusicProviderConfig>("/providers/music/config", {
            method: "PUT",
            body: JSON.stringify(data),
        });
    },

    listMusicProviders() {
        return request<MusicProviderListResponse>("/providers/music");
    },

    // ---- Marketplace ----

    searchModels(query: string, pipelineTag: string, sort = "downloads", limit = 20) {
        const params = new URLSearchParams({
            q: query,
            pipeline_tag: pipelineTag,
            sort,
            limit: String(limit),
        });
        return request<HFSearchResponse>(`/marketplace/search?${params}`);
    },

    downloadModel(repoId: string) {
        return request<DownloadProgress>("/marketplace/download", {
            method: "POST",
            body: JSON.stringify({repo_id: repoId}),
        });
    },

    async getDownloadProgress() {
        const res = await request<{ downloads: DownloadProgress[] }>("/marketplace/downloads");
        return res.downloads;
    },

    async getCachedModels() {
        const res = await request<{ models: CachedModelInfo[] }>("/marketplace/cache");
        return res.models;
    },

    deleteCachedModel(repoId: string) {
        return request<void>(`/marketplace/cache/${repoId}`, {
            method: "DELETE",
        });
    },
};

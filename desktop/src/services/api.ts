import type {
  Generation,
  GenerateMusicRequest,
  GenerateLyricsRequest,
  GenerateLyricsResponse,
  EnhancePromptRequest,
  EnhancePromptResponse,
  ProviderInfo,
  StyleSuggestRequest,
  StyleSuggestion,
  TitleGenerateRequest,
  ExtendRequest,
  RemixRequest,
  CoverArtRequest,
  CoverArtResponse,
  LLMConfig,
  LLMTestRequest,
  LLMTestResponse,
  OllamaStatus,
  MusicProviderConfig,
  HFSearchResponse,
  HFModelInfo,
  DownloadProgress,
  CachedModelInfo,
} from "../types";

const DEFAULT_BASE_URL = "http://127.0.0.1:23456/api/v1";

let baseUrl = DEFAULT_BASE_URL;

export function setBaseUrl(url: string) {
  baseUrl = url.replace(/\/+$/, "");
}

export function getBaseUrl(): string {
  return baseUrl;
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

  enhancePrompt(data: EnhancePromptRequest) {
    return request<EnhancePromptResponse>("/generate/enhance-prompt", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  suggestStyle(data: StyleSuggestRequest) {
    return request<StyleSuggestion>("/generate/suggest-style", {
      method: "POST",
      body: JSON.stringify(data),
    });
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

  getGeneration(id: number) {
    return request<Generation>(`/generations/${id}`);
  },

  deleteGeneration(id: number) {
    return request<void>(`/generations/${id}`, { method: "DELETE" });
  },

  async getProviders(type: "llm" | "music") {
    // Backend returns {providers: ProviderInfo[]}
    const data = await request<{ providers: ProviderInfo[] }>(`/providers/${type}`);
    return data.providers;
  },

  getAudioUrl(audioPath: string) {
    // Extract basename from full filesystem path
    const basename = audioPath.split("/").pop() || audioPath;
    return `${baseUrl}/audio/${basename}`;
  },

  getCoverArtUrl(coverPath: string) {
    const basename = coverPath.split("/").pop() || coverPath;
    return `${baseUrl}/covers/${basename}`;
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

  getOllamaStatus(baseUrl = "http://localhost:11434") {
    return request<OllamaStatus>(
      `/providers/ollama/status?base_url=${encodeURIComponent(baseUrl)}`,
    );
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

  getModelInfo(repoId: string) {
    return request<HFModelInfo>(`/marketplace/model/${repoId}`);
  },

  downloadModel(repoId: string) {
    return request<DownloadProgress>("/marketplace/download", {
      method: "POST",
      body: JSON.stringify({ repo_id: repoId }),
    });
  },

  getDownloadProgress() {
    return request<DownloadProgress[]>("/marketplace/downloads");
  },

  getDownloadById(downloadId: string) {
    return request<DownloadProgress>(`/marketplace/downloads/${downloadId}`);
  },

  getCachedModels() {
    return request<CachedModelInfo[]>("/marketplace/cache");
  },

  deleteCachedModel(repoId: string) {
    return request<void>(`/marketplace/cache/${repoId}`, {
      method: "DELETE",
    });
  },
};

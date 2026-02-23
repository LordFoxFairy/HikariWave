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
} from "../types";

const DEFAULT_BASE_URL = "http://127.0.0.1:8000/api/v1";

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

  async getGenerations() {
    // Backend returns {items: Generation[], total: number}
    const data = await request<{ items: Generation[]; total: number }>("/generations");
    return data.items;
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
    return `${baseUrl}/cover/${basename}`;
  },

  healthCheck() {
    return request<{ status: string }>("/health");
  },
};

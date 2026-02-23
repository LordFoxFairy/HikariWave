import type {
  Generation,
  GenerateMusicRequest,
  GenerateLyricsRequest,
  GenerateLyricsResponse,
  EnhancePromptRequest,
  EnhancePromptResponse,
  TaskStatus,
  ProviderInfo,
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
    return request<{ task_id: string }>("/generate/music", {
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

  getTaskStatus(taskId: string) {
    return request<TaskStatus>(`/tasks/${taskId}`);
  },

  getGenerations() {
    return request<Generation[]>("/generations");
  },

  getGeneration(id: number) {
    return request<Generation>(`/generations/${id}`);
  },

  deleteGeneration(id: number) {
    return request<void>(`/generations/${id}`, { method: "DELETE" });
  },

  getProviders(type: "llm" | "music") {
    return request<ProviderInfo[]>(`/providers/${type}`);
  },

  getAudioUrl(fileId: string) {
    return `${baseUrl}/audio/${fileId}`;
  },

  healthCheck() {
    return request<{ status: string }>("/health");
  },
};

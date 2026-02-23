export type GenerationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface Generation {
  id: number;
  task_id: string;
  status: GenerationStatus;
  prompt: string;
  enhanced_prompt?: string;
  lyrics?: string;
  genre?: string;
  mood?: string;
  duration: number;
  llm_provider?: string;
  music_provider: string;
  audio_path?: string;
  audio_format: string;
  actual_duration?: number;
  generation_params: Record<string, unknown>;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface GenerateMusicRequest {
  prompt: string;
  lyrics?: string;
  genre?: string;
  mood?: string;
  duration?: number;
}

export interface GenerateLyricsRequest {
  prompt: string;
  genre?: string;
  mood?: string;
}

export interface GenerateLyricsResponse {
  lyrics: string;
  suggestions?: StyleSuggestion;
}

export interface EnhancePromptRequest {
  prompt: string;
}

export interface EnhancePromptResponse {
  enhanced_prompt: string;
}

export interface StyleSuggestion {
  genre: string;
  sub_genre: string;
  tempo: string;
  key: string;
  instruments: string[];
  references: string[];
}

export interface TaskStatus {
  task_id: string;
  status: GenerationStatus;
  progress?: number;
  message?: string;
}

export interface ProviderInfo {
  name: string;
  provider_type: "llm" | "music";
  models: string[];
  is_active: boolean;
}

export interface AppSettings {
  backendUrl: string;
  llmProvider: string;
  musicProvider: string;
}

export type PageId =
  | "create"
  | "history"
  | "settings";

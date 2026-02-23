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
  title?: string;
  cover_art_path?: string;
  tempo?: number;
  musical_key?: string;
  instruments?: string[];
  language?: string;
  instrumental?: boolean;
  progress?: number;
  progress_message?: string;
  parent_id?: number;
  parent_type?: string;
  is_liked?: boolean;
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
  title?: string;
  tempo?: number;
  musical_key?: string;
  instruments?: string[];
  language?: string;
  instrumental?: boolean;
  generate_cover?: boolean;
}

export interface ExtendRequest {
  generation_id: number;
  prompt?: string;
  lyrics?: string;
  duration?: number;
}

export interface RemixRequest {
  generation_id: number;
  genre?: string;
  mood?: string;
  tempo?: number;
  musical_key?: string;
  instruments?: string[];
  prompt?: string;
}

export interface CoverArtRequest {
  generation_id: number;
  title?: string;
  genre?: string;
  mood?: string;
  lyrics?: string;
}

export interface CoverArtResponse {
  cover_art_path: string;
  prompt_used: string;
}

export interface GenerateLyricsRequest {
  prompt: string;
  genre?: string;
  mood?: string;
  language?: string;
}

export interface GenerateLyricsResponse {
  lyrics: string;
  genre?: string;
  mood?: string;
  suggestions?: StyleSuggestion;
}

export interface EnhancePromptRequest {
  prompt: string;
}

export interface EnhancePromptResponse {
  enhanced_prompt: string;
}

export interface StyleSuggestion {
  genres: string[];
  moods: string[];
  tempo: number;
  musical_key: string;
  instruments: string[];
  title_suggestion: string;
  references: string[];
}

export interface StyleSuggestRequest {
  prompt: string;
  genre?: string;
  mood?: string;
}

export interface TitleGenerateRequest {
  lyrics: string;
  genre?: string;
  mood?: string;
}

export interface TaskStatus {
  id: number;
  task_id: string;
  status: GenerationStatus;
  progress?: number;
  prompt: string;
  audio_path?: string;
  error_message?: string;
}

export interface ProviderInfo {
  name: string;
  provider_type: string;
  models: string[];
  is_active: boolean;
  is_healthy?: boolean;
}

export interface MusicConfig {
  genres: string[];
  moods: string[];
  duration: number;
  tempo: number;
  musicalKey: string;
  instruments: string[];
  language: string;
  instrumental: boolean;
}

export type CreateMode = "smart" | "custom";

export interface AppSettings {
  backendUrl: string;
  llmProvider: string;
  musicProvider: string;
}

export type PageId =
  | "create"
  | "history"
  | "settings";

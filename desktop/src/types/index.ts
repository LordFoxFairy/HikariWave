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
    lrc_lyrics?: string;
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
    generation_params?: Record<string, unknown>;
    error_message?: string;
    created_at: string;
    completed_at?: string;
}

export type TaskType = "text2music" | "cover" | "repaint";

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
    enhance_prompt?: boolean;
    generate_lyrics?: boolean;
    seed?: number;
    task_type?: TaskType;
    audio_cover_strength?: number;
    cover_noise_strength?: number;
    repainting_start?: number;
    repainting_end?: number;
}

export interface StyleReferenceResult {
    caption: string;
    genre?: string | null;
    mood?: string | null;
    tempo?: number | null;
    musical_key?: string | null;
    instruments: string[];
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
    duration?: number;
    title?: string;
}

export interface GenerateLyricsResponse {
    lyrics: string;
    genre?: string;
    mood?: string;
    suggestions?: StyleSuggestion;
}

export interface StyleSuggestion {
    genres: string[];
    moods: string[];
    tempo?: number | null;
    musical_key?: string | null;
    instruments: string[];
    title_suggestion?: string | null;
    references: string[];
}

export interface StyleSuggestRequest {
    prompt: string;
    genre?: string;
    mood?: string;
}

export interface TitleGenerateRequest {
    prompt?: string;
    lyrics?: string;
    genre?: string;
    mood?: string;
}

export type CreateMode = "smart" | "custom";

export type PageId =
    | "create"
    | "library"
    | "providers"
    | "settings"
    | "detail";

// ---- LLM config management types ----

export type LLMProviderType = "openrouter" | "ollama" | "openai_compat";

export interface LLMProviderEntry {
    name: string;
    type: LLMProviderType;
    base_url: string;
    api_key: string;
    models: string[];
}

export interface LLMConfig {
    providers: LLMProviderEntry[];
    router: Record<string, string>;
}

export interface LLMTestRequest {
    type: LLMProviderType;
    base_url: string;
    api_key?: string;
    model?: string;
    name?: string;
}

export interface LLMTestResponse {
    success: boolean;
    message: string;
    models: string[];
}

// ---- Music config management types ----

export interface MusicModelEntry {
    name: string;
    model_id: string;
}

export interface MusicProviderEntry {
    name: string;
    type: string;
    models: MusicModelEntry[];
}

export interface MusicProviderConfig {
    providers: MusicProviderEntry[];
    router: Record<string, string>;
}

export interface MusicProviderStatus {
    name: string;
    provider_type: string;
    models: MusicModelEntry[];
    is_active: boolean;
    is_downloaded: boolean;
}

export interface MusicProviderListResponse {
    providers: MusicProviderStatus[];
}

// ---- Marketplace types ----

export interface HFModelInfo {
    id: string;
    author: string;
    pipeline_tag: string;
    downloads: number;
    likes: number;
    tags: string[];
    license: string;
    size_str: string;
    library_name: string;
    is_cached: boolean;
}

export interface HFSearchResponse {
    models: HFModelInfo[];
    total: number;
}

export interface DownloadProgress {
    download_id: string;
    repo_id: string;
    status: "pending" | "downloading" | "completed" | "failed";
    progress: number;
    message: string;
}

export interface CachedModelInfo {
    repo_id: string;
    size_str: string;
    nb_files: number;
    last_accessed: number;
}

export type ProviderTab = "llm" | "music";

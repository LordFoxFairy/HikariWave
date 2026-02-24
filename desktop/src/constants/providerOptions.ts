import {Brain, Music} from "lucide-react";
import type {LLMProviderEntry, LLMProviderType, ProviderTab} from "../types";

// ---- Tab configuration ----

export const TABS: { id: ProviderTab; labelKey: string; icon: typeof Brain }[] = [
    {id: "llm", labelKey: "providers.llm", icon: Brain},
    {id: "music", labelKey: "providers.music", icon: Music},
];

// ---- LLM constants ----

export const LLM_ROUTER_TASKS = [
    {key: "default", labelKey: "providers.routerDefault"},
    {key: "lyrics", labelKey: "providers.routerLyrics"},
    {key: "enhancement", labelKey: "providers.routerEnhancement"},
    {key: "suggestion", labelKey: "providers.routerSuggestion"},
    {key: "cover_art", labelKey: "providers.routerCoverArt"},
] as const;

export const PROVIDER_TYPE_LABEL_KEYS: Record<LLMProviderType, string> = {
    openrouter: "providers.openrouter",
    ollama: "providers.ollama",
    openai_compat: "providers.openaiCompat",
};

export const PROVIDER_TYPE_COLORS: Record<LLMProviderType, string> = {
    openrouter: "bg-violet-100 text-violet-700",
    ollama: "bg-emerald-100 text-emerald-700",
    openai_compat: "bg-blue-100 text-blue-700",
};

export const EMPTY_PROVIDER: LLMProviderEntry = {
    name: "",
    type: "openrouter",
    base_url: "",
    api_key: "",
    models: [],
};

export const DEFAULT_URLS: Record<LLMProviderType, string> = {
    openrouter: "https://openrouter.ai/api/v1",
    ollama: "http://localhost:11434",
    openai_compat: "",
};

// ---- Music constants ----

export const MUSIC_ROUTER_TASKS = [
    {key: "default", labelKey: "providers.routerDefault"},
] as const;

// ---- Helpers ----

export function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
}

export function licenseBadgeColor(license: string): string {
    const l = license.toLowerCase();
    if (["mit", "apache", "bsd", "unlicense", "isc"].some((k) => l.includes(k))) {
        return "bg-emerald-100 text-emerald-700";
    }
    if (["cc", "creative commons"].some((k) => l.includes(k))) {
        return "bg-amber-100 text-amber-700";
    }
    return "bg-red-100 text-red-600";
}

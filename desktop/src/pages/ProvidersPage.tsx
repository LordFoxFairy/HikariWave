import { useState, useEffect, useCallback, useRef } from "react";
import {
  Brain,
  Music,
  ImageIcon,
  Plus,
  Trash2,
  Pencil,
  Zap,
  Globe,
  X,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Loader2,
  Search,
  Download,
  HardDrive,
  Heart,
  ArrowDownUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProviderStore } from "../stores/providerStore";
import { api } from "../services/api";
import type {
  ProviderTab,
  LLMProviderEntry,
  LLMProviderType,
  LLMConfig,
  LLMTestResponse,
  OllamaStatus,
  MusicProviderConfig,
  MusicModelEntry,
  HFModelInfo,
  DownloadProgress,
  CachedModelInfo,
} from "../types";

// ---- Constants ----

const TABS: { id: ProviderTab; label: string; icon: typeof Brain }[] = [
  { id: "llm", label: "LLM", icon: Brain },
  { id: "music", label: "Music", icon: Music },
  { id: "image", label: "Image", icon: ImageIcon },
];

const ROUTER_TASKS = [
  { key: "default", label: "Default" },
  { key: "lyrics", label: "Lyrics" },
  { key: "enhancement", label: "Enhancement" },
  { key: "suggestion", label: "Suggestion" },
  { key: "cover_art", label: "Cover Art" },
] as const;

const PROVIDER_TYPE_LABELS: Record<LLMProviderType, string> = {
  openrouter: "OpenRouter",
  ollama: "Ollama (Local)",
  openai_compat: "OpenAI-Compatible",
};

const PROVIDER_TYPE_COLORS: Record<LLMProviderType, string> = {
  openrouter: "bg-violet-100 text-violet-700",
  ollama: "bg-emerald-100 text-emerald-700",
  openai_compat: "bg-blue-100 text-blue-700",
};

const EMPTY_PROVIDER: LLMProviderEntry = {
  name: "",
  type: "openrouter",
  base_url: "",
  api_key: "",
  models: [],
};

const DEFAULT_URLS: Record<LLMProviderType, string> = {
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434",
  openai_compat: "",
};

// ---- Helpers ----

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function licenseBadgeColor(license: string): string {
  const l = license.toLowerCase();
  if (["mit", "apache", "bsd", "unlicense", "isc"].some((k) => l.includes(k))) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (["cc", "creative commons"].some((k) => l.includes(k))) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-red-100 text-red-600";
}

// ---- Main Page ----

export default function ProvidersPage() {
  const { activeTab, setActiveTab } = useProviderStore();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold text-text-primary tracking-tight">
            Providers
          </h1>
          <p className="text-[13px] text-text-tertiary mt-1">
            Manage AI providers, models, and marketplace
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex bg-surface-secondary rounded-xl p-1 mb-6 relative">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4
                         rounded-lg text-sm font-medium transition-colors relative z-10
                         cursor-pointer ${
                           activeTab === id
                             ? "text-primary-700"
                             : "text-text-tertiary hover:text-text-secondary"
                         }`}
            >
              {activeTab === id && (
                <motion.div
                  layoutId="provider-tab-bg"
                  className="absolute inset-0 bg-white rounded-lg shadow-sm"
                  transition={{ type: "spring", duration: 0.35, bounce: 0.15 }}
                />
              )}
              <Icon className="w-4 h-4 relative z-10" />
              <span className="relative z-10">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "llm" && <LLMTab />}
            {activeTab === "music" && <MusicTab />}
            {activeTab === "image" && <ImageTab />}
          </motion.div>
        </AnimatePresence>

        {/* Bottom spacer for player clearance */}
        <div className="h-20" />
      </div>
    </div>
  );
}

// ============================
// LLM Tab
// ============================

function LLMTab() {
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<LLMProviderEntry>({ ...EMPTY_PROVIDER });
  const [formModels, setFormModels] = useState("");
  const [testResult, setTestResult] = useState<LLMTestResponse | null>(null);
  const [testingProvider, setTestingProvider] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [detectingOllama, setDetectingOllama] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const config = await api.getLLMConfig();
      setLlmConfig(config);
    } catch {
      /* backend might not be running */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAddForm = () => {
    setFormData({ ...EMPTY_PROVIDER });
    setFormModels("");
    setTestResult(null);
    setEditingIndex(null);
    setShowAddForm(true);
  };

  const openEditForm = (index: number) => {
    if (!llmConfig) return;
    const p = llmConfig.providers[index];
    setFormData({ ...p });
    setFormModels(p.models.join(", "));
    setTestResult(null);
    setEditingIndex(index);
    setShowAddForm(true);
  };

  const closeForm = () => {
    setShowAddForm(false);
    setEditingIndex(null);
    setTestResult(null);
  };

  const handleTypeChange = (type: LLMProviderType) => {
    setFormData((d) => ({
      ...d,
      type,
      base_url: DEFAULT_URLS[type] || d.base_url,
    }));
  };

  const handleTestConnection = async () => {
    setTestingProvider(true);
    setTestResult(null);
    try {
      const result = await api.testLLMConnection({
        type: formData.type,
        base_url: formData.base_url,
        api_key: formData.api_key,
        model: formData.models[0] || "",
      });
      setTestResult(result);
      if (result.success && result.models.length > 0 && formData.type === "ollama") {
        setFormModels(result.models.join(", "));
        setFormData((d) => ({ ...d, models: result.models }));
      }
    } catch (e) {
      setTestResult({
        success: false,
        message: e instanceof Error ? e.message : "Connection failed",
        models: [],
      });
    } finally {
      setTestingProvider(false);
    }
  };

  const handleSaveProvider = async () => {
    if (!llmConfig || !formData.name.trim()) return;
    setSaving(true);
    const models = formModels
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    const entry: LLMProviderEntry = { ...formData, models };
    const newProviders = [...llmConfig.providers];
    if (editingIndex !== null) {
      newProviders[editingIndex] = entry;
    } else {
      newProviders.push(entry);
    }
    const router = { ...llmConfig.router };
    if (!router.default && newProviders.length > 0 && models.length > 0) {
      router.default = `${entry.name}:${models[0]}`;
    }
    try {
      const updated = await api.updateLLMConfig({ providers: newProviders, router });
      setLlmConfig(updated);
      closeForm();
    } catch {
      /* noop */
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (index: number) => {
    if (!llmConfig) return;
    const name = llmConfig.providers[index].name;
    const newProviders = llmConfig.providers.filter((_, i) => i !== index);
    const router = { ...llmConfig.router };
    for (const [key, val] of Object.entries(router)) {
      if (val.startsWith(`${name}:`)) {
        router[key] = "";
      }
    }
    setSaving(true);
    try {
      const updated = await api.updateLLMConfig({ providers: newProviders, router });
      setLlmConfig(updated);
    } catch {
      /* noop */
    } finally {
      setSaving(false);
    }
  };

  const handleRouterChange = async (task: string, value: string) => {
    if (!llmConfig) return;
    const router = { ...llmConfig.router, [task]: value };
    setSaving(true);
    try {
      const updated = await api.updateLLMConfig({
        providers: llmConfig.providers,
        router,
      });
      setLlmConfig(updated);
    } catch {
      /* noop */
    } finally {
      setSaving(false);
    }
  };

  const allModelOptions: { label: string; value: string }[] = [];
  if (llmConfig) {
    for (const p of llmConfig.providers) {
      for (const m of p.models) {
        allModelOptions.push({
          label: `${p.name} / ${m}`,
          value: `${p.name}:${m}`,
        });
      }
    }
  }

  const handleDetectOllama = async () => {
    setDetectingOllama(true);
    try {
      const status = await api.getOllamaStatus();
      setOllamaStatus(status);
    } catch {
      setOllamaStatus({ available: false, models: [] });
    } finally {
      setDetectingOllama(false);
    }
  };

  const handleAddOllama = (models: string[]) => {
    setFormData({
      name: "ollama",
      type: "ollama",
      base_url: "http://localhost:11434",
      api_key: "",
      models,
    });
    setFormModels(models.join(", "));
    setTestResult(null);
    setEditingIndex(null);
    setShowAddForm(true);
  };

  return (
    <div className="space-y-5">
      {/* Provider Cards */}
      <SectionHeader icon={Brain} title="LLM Providers" />
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
            <span className="text-sm text-text-tertiary ml-2">Loading...</span>
          </div>
        ) : llmConfig && llmConfig.providers.length > 0 ? (
          <div className="space-y-3">
            {llmConfig.providers.map((p, idx) => (
              <LLMProviderCard
                key={`${p.name}-${idx}`}
                provider={p}
                isDefault={llmConfig.router.default?.startsWith(`${p.name}:`) ?? false}
                onEdit={() => openEditForm(idx)}
                onDelete={() => handleDeleteProvider(idx)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No LLM providers configured</p>
        )}

        {/* Ollama detection */}
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-xs font-medium text-text-secondary">
              Local Ollama
            </span>
            <button
              onClick={handleDetectOllama}
              disabled={detectingOllama}
              className="ml-auto text-xs text-primary-600 hover:text-primary-700
                         cursor-pointer flex items-center gap-1"
            >
              {detectingOllama && <Loader2 className="w-3 h-3 animate-spin" />}
              Detect
            </button>
          </div>
          {ollamaStatus && (
            <div className="text-xs">
              {ollamaStatus.available ? (
                <div>
                  <p className="text-green-600 mb-1">
                    Ollama running -- {ollamaStatus.models.length} model(s)
                  </p>
                  {ollamaStatus.models.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {ollamaStatus.models.map((m) => (
                        <span
                          key={m}
                          className="px-2 py-0.5 bg-emerald-50 text-emerald-700
                                     rounded text-[11px]"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                  {!llmConfig?.providers.some((p) => p.type === "ollama") && (
                    <button
                      onClick={() => handleAddOllama(ollamaStatus.models)}
                      className="text-primary-600 hover:text-primary-700
                                 font-medium cursor-pointer"
                    >
                      + Add Ollama as provider
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-text-tertiary">
                  Ollama not detected at localhost:11434
                </p>
              )}
            </div>
          )}
        </div>

        {/* Add provider button */}
        <div className="mt-4 pt-4 border-t border-border">
          <button
            onClick={openAddForm}
            className="flex items-center gap-1.5 text-sm text-primary-600
                       hover:text-primary-700 font-medium cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </button>
        </div>
      </div>

      {/* Add/Edit Provider Modal */}
      <AnimatePresence>
        {showAddForm && (
          <ProviderFormModal
            formData={formData}
            formModels={formModels}
            editingIndex={editingIndex}
            testResult={testResult}
            testingProvider={testingProvider}
            saving={saving}
            onFormDataChange={setFormData}
            onFormModelsChange={setFormModels}
            onTypeChange={handleTypeChange}
            onTest={handleTestConnection}
            onSave={handleSaveProvider}
            onClose={closeForm}
          />
        )}
      </AnimatePresence>

      {/* Router Config */}
      {llmConfig && llmConfig.providers.length > 0 && (
        <>
          <SectionHeader icon={Globe} title="LLM Task Router" />
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <p className="text-xs text-text-tertiary mb-4">
              Choose which provider and model handles each task type.
            </p>
            <div className="space-y-3">
              {ROUTER_TASKS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-sm font-medium text-text-secondary w-28 flex-shrink-0">
                    {label}
                  </label>
                  <div className="relative flex-1">
                    <select
                      value={llmConfig.router[key] || ""}
                      onChange={(e) => handleRouterChange(key, e.target.value)}
                      className="w-full appearance-none px-3 py-2 pr-8 rounded-lg
                                 border border-border bg-surface-secondary text-sm
                                 focus:outline-none focus:ring-2
                                 focus:ring-primary-300 cursor-pointer"
                    >
                      <option value="">-- not set --</option>
                      {allModelOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="absolute right-2.5 top-1/2 -translate-y-1/2
                                 w-3.5 h-3.5 text-text-tertiary pointer-events-none"
                    />
                  </div>
                </div>
              ))}
            </div>
            {saving && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-text-tertiary">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ============================
// Music Tab
// ============================

const MUSIC_ROUTER_TASKS = [
  { key: "default", label: "Default" },
  { key: "vocal", label: "Vocal (with lyrics)" },
  { key: "instrumental", label: "Instrumental" },
] as const;

function MusicTab() {
  const {
    searchQuery,
    searchResults,
    searchLoading,
    setSearchQuery,
    searchModels,
    downloads,
    startDownload,
    refreshDownloads,
    cachedModels,
    refreshCache,
    deleteCache,
  } = useProviderStore();

  const [musicConfig, setMusicConfig] = useState<MusicProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState<string>("downloads");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadConfig = useCallback(async () => {
    try {
      const config = await api.getMusicConfig();
      setMusicConfig(config);
    } catch {
      /* backend might not be running */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    refreshCache();
    refreshDownloads();
  }, [loadConfig, refreshCache, refreshDownloads]);

  // Poll active downloads
  useEffect(() => {
    const hasActive = downloads.some(
      (d) => d.status === "pending" || d.status === "downloading",
    );
    if (hasActive) {
      pollRef.current = setInterval(() => {
        refreshDownloads();
      }, 2000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [downloads, refreshDownloads]);

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchModels(q, "text-to-audio");
      }, 300);
    },
    [setSearchQuery, searchModels],
  );

  const handleSort = (sort: string) => {
    setSortBy(sort);
    searchModels(searchQuery, "text-to-audio");
  };

  // All model options for router dropdowns
  const allModelOptions: { label: string; value: string }[] = [];
  if (musicConfig) {
    for (const p of musicConfig.providers) {
      for (const m of p.models) {
        allModelOptions.push({
          label: `${p.name} / ${m.name}`,
          value: `${p.name}:${m.name}`,
        });
      }
    }
  }

  const handleRouterChange = async (task: string, value: string) => {
    if (!musicConfig) return;
    const router = { ...musicConfig.router, [task]: value };
    setSaving(true);
    try {
      const updated = await api.updateMusicConfig({
        providers: musicConfig.providers,
        router,
      });
      setMusicConfig(updated);
    } catch {
      /* noop */
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModel = async (providerIdx: number, modelIdx: number) => {
    if (!musicConfig) return;
    const newProviders = musicConfig.providers.map((p, pi) => {
      if (pi !== providerIdx) return p;
      return { ...p, models: p.models.filter((_, mi) => mi !== modelIdx) };
    });
    setSaving(true);
    try {
      const updated = await api.updateMusicConfig({
        providers: newProviders,
        router: musicConfig.router,
      });
      setMusicConfig(updated);
    } catch {
      /* noop */
    } finally {
      setSaving(false);
    }
  };

  const handleAddToConfig = async (repoId: string) => {
    if (!musicConfig) return;
    // Extract model name from repo_id (e.g. "facebook/musicgen-small" → "musicgen-small")
    const modelName = repoId.split("/").pop() || repoId;
    const newModel: MusicModelEntry = { name: modelName, model_id: repoId };

    // Add to first provider, or create one
    let newProviders = [...musicConfig.providers];
    if (newProviders.length === 0) {
      newProviders = [{ name: "local", type: "local_gpu", models: [newModel] }];
    } else {
      // Check if already registered
      const alreadyExists = newProviders.some((p) =>
        p.models.some((m) => m.model_id === repoId || m.name === modelName),
      );
      if (alreadyExists) return;
      newProviders = newProviders.map((p, i) =>
        i === 0 ? { ...p, models: [...p.models, newModel] } : p,
      );
    }

    setSaving(true);
    try {
      const updated = await api.updateMusicConfig({
        providers: newProviders,
        router: musicConfig.router,
      });
      setMusicConfig(updated);
    } catch {
      /* noop */
    } finally {
      setSaving(false);
    }
  };

  // Check which cached models are already in config
  const registeredModelIds = new Set<string>();
  if (musicConfig) {
    for (const p of musicConfig.providers) {
      for (const m of p.models) {
        registeredModelIds.add(m.model_id);
        registeredModelIds.add(m.name);
      }
    }
  }

  const cachedRepoIds = new Set(cachedModels.map((c) => c.repo_id));
  const activeDownloads = new Map(
    downloads
      .filter((d) => d.status === "pending" || d.status === "downloading")
      .map((d) => [d.repo_id, d]),
  );

  const handleDownload = async (repoId: string) => {
    await startDownload(repoId);
    refreshDownloads();
  };

  return (
    <div className="space-y-5">
      {/* Registered Music Models */}
      <SectionHeader icon={Music} title="Music Models" />
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
            <span className="text-sm text-text-tertiary ml-2">Loading...</span>
          </div>
        ) : musicConfig && musicConfig.providers.length > 0 ? (
          <div className="space-y-2">
            {musicConfig.providers.map((provider, pi) =>
              provider.models.map((model, mi) => {
                const key = `${provider.name}:${model.name}`;
                const isRouted = Object.values(musicConfig.router).includes(key);
                return (
                  <div
                    key={`${pi}-${mi}`}
                    className={`px-4 py-3 rounded-lg border text-sm transition-all
                                flex items-center gap-3 ${
                      isRouted
                        ? "border-primary-300 bg-primary-50/50"
                        : "border-border hover:bg-surface-secondary"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isRouted ? "bg-green-500" : "bg-border"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">{model.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium
                                         bg-emerald-100 text-emerald-700">
                          {provider.name}
                        </span>
                        {isRouted && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium
                                           bg-primary-100 text-primary-700">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary truncate mt-0.5">
                        {model.model_id || "No model ID"}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteModel(pi, mi)}
                      className="p-1.5 rounded-md hover:bg-red-50
                                 text-text-tertiary hover:text-red-500
                                 transition-colors cursor-pointer"
                      title="Remove model"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }),
            )}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">
            No music models configured. Download models from the marketplace
            below and add them to your config.
          </p>
        )}
        {saving && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-text-tertiary">
            <Loader2 className="w-3 h-3 animate-spin" />
            Saving...
          </div>
        )}
      </div>

      {/* Music Router Config */}
      {musicConfig && allModelOptions.length > 0 && (
        <>
          <SectionHeader icon={Globe} title="Music Task Router" />
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <p className="text-xs text-text-tertiary mb-4">
              Choose which model handles each generation task.
            </p>
            <div className="space-y-3">
              {MUSIC_ROUTER_TASKS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="text-sm font-medium text-text-secondary w-36 flex-shrink-0">
                    {label}
                  </label>
                  <div className="relative flex-1">
                    <select
                      value={musicConfig.router[key] || ""}
                      onChange={(e) => handleRouterChange(key, e.target.value)}
                      className="w-full appearance-none px-3 py-2 pr-8 rounded-lg
                                 border border-border bg-surface-secondary text-sm
                                 focus:outline-none focus:ring-2
                                 focus:ring-primary-300 cursor-pointer"
                    >
                      <option value="">-- not set --</option>
                      {allModelOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="absolute right-2.5 top-1/2 -translate-y-1/2
                                 w-3.5 h-3.5 text-text-tertiary pointer-events-none"
                    />
                  </div>
                </div>
              ))}
            </div>
            {saving && (
              <div className="flex items-center gap-1.5 mt-3 text-xs text-text-tertiary">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </div>
            )}
          </div>
        </>
      )}

      {/* Model Marketplace */}
      <SectionHeader icon={Search} title="Model Marketplace" />
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        {/* Search bar */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search music generation models..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => handleSort(e.target.value)}
              className="appearance-none px-3 py-2.5 pr-8 rounded-xl border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300 cursor-pointer"
            >
              <option value="downloads">Most Downloaded</option>
              <option value="likes">Most Liked</option>
              <option value="trending">Trending</option>
            </select>
            <ArrowDownUp className="absolute right-2.5 top-1/2 -translate-y-1/2
                                    w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
          </div>
        </div>

        {/* Results */}
        {searchLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
            <span className="text-sm text-text-tertiary ml-2">Searching...</span>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {searchResults.map((model) => (
              <MarketplaceCard
                key={model.id}
                model={model}
                isCached={cachedRepoIds.has(model.id)}
                activeDownload={activeDownloads.get(model.id)}
                onDownload={() => handleDownload(model.id)}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <p className="text-sm text-text-tertiary text-center py-8">
            No models found for &ldquo;{searchQuery}&rdquo;
          </p>
        ) : (
          <p className="text-sm text-text-tertiary text-center py-8">
            Search for music generation models from HuggingFace
          </p>
        )}
      </div>

      {/* Local Models / Cache */}
      <SectionHeader icon={HardDrive} title="Local Models" />
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        {cachedModels.length > 0 ? (
          <div className="space-y-2">
            {cachedModels.map((model) => {
              const isRegistered =
                registeredModelIds.has(model.repo_id) ||
                registeredModelIds.has(model.repo_id.split("/").pop() || "");
              return (
                <div
                  key={model.repo_id}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border
                             hover:bg-surface-secondary transition-colors"
                >
                  <HardDrive className="w-4 h-4 text-text-tertiary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {model.repo_id}
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      {model.size_str} -- {model.nb_files} files
                    </p>
                  </div>
                  {isRegistered ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium
                                     flex-shrink-0">
                      <CheckCircle className="w-3.5 h-3.5" />
                      In config
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAddToConfig(model.repo_id)}
                      disabled={saving}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                                 border border-primary-200 bg-primary-50
                                 text-primary-700 text-xs font-medium
                                 hover:bg-primary-100 transition-colors
                                 cursor-pointer disabled:opacity-50 flex-shrink-0"
                    >
                      <Plus className="w-3 h-3" />
                      Add to Config
                    </button>
                  )}
                  <button
                    onClick={() => deleteCache(model.repo_id)}
                    className="p-1.5 rounded-md hover:bg-red-50 text-text-tertiary
                               hover:text-red-500 transition-colors cursor-pointer
                               flex-shrink-0"
                    title="Delete cached model"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">
            No locally cached models yet. Download models from the marketplace above.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================
// Image Tab
// ============================

function ImageTab() {
  const {
    searchQuery,
    searchResults,
    searchLoading,
    setSearchQuery,
    searchModels,
    downloads,
    startDownload,
    refreshDownloads,
    cachedModels,
    refreshCache,
    deleteCache,
  } = useProviderStore();

  const [sortBy, setSortBy] = useState<string>("downloads");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    refreshCache();
    refreshDownloads();
  }, [refreshCache, refreshDownloads]);

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchModels(q, "text-to-image");
      }, 300);
    },
    [setSearchQuery, searchModels],
  );

  const handleSort = (sort: string) => {
    setSortBy(sort);
    searchModels(searchQuery, "text-to-image");
  };

  const cachedRepoIds = new Set(cachedModels.map((c) => c.repo_id));
  const activeDownloads = new Map(
    downloads
      .filter((d) => d.status === "pending" || d.status === "downloading")
      .map((d) => [d.repo_id, d]),
  );

  const handleDownload = async (repoId: string) => {
    await startDownload(repoId);
    refreshDownloads();
  };

  return (
    <div className="space-y-5">
      {/* Image provider config placeholder */}
      <SectionHeader icon={ImageIcon} title="Image Providers" />
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <p className="text-sm text-text-tertiary">
          Image generation providers will be configurable here. Connect an API provider
          or browse models from the marketplace below.
        </p>
      </div>

      {/* Image Model Marketplace */}
      <SectionHeader icon={Search} title="Image Model Marketplace" />
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <div className="flex gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search image generation models..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => handleSort(e.target.value)}
              className="appearance-none px-3 py-2.5 pr-8 rounded-xl border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300 cursor-pointer"
            >
              <option value="downloads">Most Downloaded</option>
              <option value="likes">Most Liked</option>
              <option value="trending">Trending</option>
            </select>
            <ArrowDownUp className="absolute right-2.5 top-1/2 -translate-y-1/2
                                    w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
          </div>
        </div>

        {searchLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-text-tertiary" />
            <span className="text-sm text-text-tertiary ml-2">Searching...</span>
          </div>
        ) : searchResults.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {searchResults.map((model) => (
              <MarketplaceCard
                key={model.id}
                model={model}
                isCached={cachedRepoIds.has(model.id)}
                activeDownload={activeDownloads.get(model.id)}
                onDownload={() => handleDownload(model.id)}
              />
            ))}
          </div>
        ) : searchQuery ? (
          <p className="text-sm text-text-tertiary text-center py-8">
            No models found for "{searchQuery}"
          </p>
        ) : (
          <p className="text-sm text-text-tertiary text-center py-8">
            Search for image generation models from HuggingFace
          </p>
        )}
      </div>

      {/* Local cached image models */}
      <SectionHeader icon={HardDrive} title="Local Image Models" />
      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        {cachedModels.length > 0 ? (
          <div className="space-y-2">
            {cachedModels.map((model) => (
              <CachedModelCard
                key={model.repo_id}
                model={model}
                onDelete={() => deleteCache(model.repo_id)}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">
            No locally cached image models.
          </p>
        )}
      </div>
    </div>
  );
}

// ============================
// Shared Sub-components
// ============================

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof Brain;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className="w-4 h-4 text-primary-600" />
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
    </div>
  );
}

function LLMProviderCard({
  provider,
  isDefault,
  onEdit,
  onDelete,
}: {
  provider: LLMProviderEntry;
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`px-4 py-3 rounded-lg border text-sm transition-all flex
                  items-start gap-3 ${
        isDefault
          ? "border-primary-300 bg-primary-50/50"
          : "border-border hover:bg-surface-secondary"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-text-primary">{provider.name}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium
                        ${PROVIDER_TYPE_COLORS[provider.type]}`}
          >
            {PROVIDER_TYPE_LABELS[provider.type]}
          </span>
          {isDefault && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium
                             bg-primary-100 text-primary-700">
              Default
            </span>
          )}
        </div>
        <p className="text-xs text-text-tertiary truncate">
          {provider.base_url || "No URL"}
        </p>
        <p className="text-xs text-text-tertiary truncate mt-0.5">
          {provider.models.length > 0
            ? provider.models.join(", ")
            : "No models configured"}
        </p>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md hover:bg-surface-tertiary
                     text-text-tertiary hover:text-text-secondary
                     transition-colors cursor-pointer"
          title="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md hover:bg-red-50
                     text-text-tertiary hover:text-red-500
                     transition-colors cursor-pointer"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ProviderFormModal({
  formData,
  formModels,
  editingIndex,
  testResult,
  testingProvider,
  saving,
  onFormDataChange,
  onFormModelsChange,
  onTypeChange,
  onTest,
  onSave,
  onClose,
}: {
  formData: LLMProviderEntry;
  formModels: string;
  editingIndex: number | null;
  testResult: LLMTestResponse | null;
  testingProvider: boolean;
  saving: boolean;
  onFormDataChange: (fn: (d: LLMProviderEntry) => LLMProviderEntry) => void;
  onFormModelsChange: (v: string) => void;
  onTypeChange: (t: LLMProviderType) => void;
  onTest: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-xl border border-border shadow-xl p-6
                   w-full max-w-md mx-4"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-text-primary">
            {editingIndex !== null ? "Edit Provider" : "Add Provider"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-surface-tertiary
                       text-text-tertiary cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Provider type */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Type
            </label>
            <div className="flex gap-2">
              {(Object.keys(PROVIDER_TYPE_LABELS) as LLMProviderType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => onTypeChange(t)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs
                              font-medium transition-colors cursor-pointer ${
                    formData.type === t
                      ? "border-primary-400 bg-primary-50 text-primary-700"
                      : "border-border text-text-secondary hover:bg-surface-secondary"
                  }`}
                >
                  {PROVIDER_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Name
            </label>
            <input
              value={formData.name}
              onChange={(e) =>
                onFormDataChange((d) => ({ ...d, name: e.target.value }))
              }
              placeholder="e.g. my-openrouter"
              className="w-full px-3 py-2 rounded-lg border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Base URL */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Base URL
            </label>
            <input
              value={formData.base_url}
              onChange={(e) =>
                onFormDataChange((d) => ({ ...d, base_url: e.target.value }))
              }
              placeholder={DEFAULT_URLS[formData.type] || "https://api.example.com/v1"}
              className="w-full px-3 py-2 rounded-lg border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* API Key (not for Ollama) */}
          {formData.type !== "ollama" && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">
                API Key
              </label>
              <input
                type="password"
                value={formData.api_key}
                onChange={(e) =>
                  onFormDataChange((d) => ({ ...d, api_key: e.target.value }))
                }
                placeholder="sk-..."
                className="w-full px-3 py-2 rounded-lg border border-border
                           bg-surface-secondary text-sm focus:outline-none
                           focus:ring-2 focus:ring-primary-300"
              />
            </div>
          )}

          {/* Models */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              Models (comma-separated)
            </label>
            <input
              value={formModels}
              onChange={(e) => onFormModelsChange(e.target.value)}
              placeholder="model-1, model-2"
              className="w-full px-3 py-2 rounded-lg border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300"
            />
          </div>

          {/* Test connection */}
          <div className="flex items-center gap-2">
            <button
              onClick={onTest}
              disabled={testingProvider || !formData.base_url}
              className="px-3 py-1.5 rounded-lg border border-border text-xs
                         font-medium text-text-secondary hover:bg-surface-secondary
                         transition-colors cursor-pointer disabled:opacity-50
                         flex items-center gap-1.5"
            >
              {testingProvider ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Zap className="w-3 h-3" />
              )}
              Test Connection
            </button>
            {testResult && (
              <span
                className={`text-xs flex items-center gap-1 ${
                  testResult.success ? "text-green-600" : "text-red-500"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {testResult.message}
              </span>
            )}
          </div>

          {/* Save / Cancel */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border text-sm
                         text-text-secondary hover:bg-surface-secondary
                         transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving || !formData.name.trim()}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm
                         font-medium hover:bg-primary-700 transition-colors
                         cursor-pointer disabled:opacity-50
                         flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingIndex !== null ? "Update" : "Add"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MarketplaceCard({
  model,
  isCached,
  activeDownload,
  onDownload,
}: {
  model: HFModelInfo;
  isCached: boolean;
  activeDownload?: DownloadProgress;
  onDownload: () => void;
}) {
  const isDownloading = !!activeDownload;
  const progress = activeDownload?.progress ?? 0;

  return (
    <div className="border border-border rounded-xl p-4 hover:shadow-md transition-shadow
                    bg-white flex flex-col gap-2.5">
      {/* Header */}
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary truncate" title={model.id}>
          {model.id.split("/").pop()}
        </p>
        <p className="text-[11px] text-text-tertiary truncate">{model.author}</p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
        <span className="flex items-center gap-1">
          <Download className="w-3 h-3" />
          {formatCount(model.downloads)}
        </span>
        <span className="flex items-center gap-1">
          <Heart className="w-3 h-3" />
          {formatCount(model.likes)}
        </span>
        {model.size_str && (
          <span className="text-[11px]">{model.size_str}</span>
        )}
      </div>

      {/* License badge */}
      {model.license && (
        <span
          className={`inline-block self-start px-2 py-0.5 rounded-full text-[10px]
                      font-medium ${licenseBadgeColor(model.license)}`}
        >
          {model.license}
        </span>
      )}

      {/* Download button / progress */}
      {isCached ? (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-auto">
          <CheckCircle className="w-3.5 h-3.5" />
          Downloaded
        </div>
      ) : isDownloading ? (
        <div className="mt-auto">
          <div className="flex items-center justify-between text-[11px] text-text-tertiary mb-1">
            <span>Downloading...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-primary-100 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      ) : (
        <button
          onClick={onDownload}
          className="mt-auto w-full py-2 rounded-lg border border-primary-200
                     bg-primary-50 text-primary-700 text-xs font-medium
                     hover:bg-primary-100 transition-colors cursor-pointer
                     flex items-center justify-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Download
        </button>
      )}
    </div>
  );
}

function CachedModelCard({
  model,
  onDelete,
}: {
  model: CachedModelInfo;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border
                    hover:bg-surface-secondary transition-colors">
      <HardDrive className="w-4 h-4 text-text-tertiary flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{model.repo_id}</p>
        <p className="text-[11px] text-text-tertiary">
          {model.size_str} -- {model.nb_files} files
        </p>
      </div>
      <button
        onClick={onDelete}
        className="p-1.5 rounded-md hover:bg-red-50 text-text-tertiary
                   hover:text-red-500 transition-colors cursor-pointer"
        title="Delete cached model"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

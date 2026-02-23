import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Cpu,
  Brain,
  CheckCircle,
  Loader2,
  Info,
  Music,
  Plus,
  Trash2,
  Pencil,
  Zap,
  Globe,
  X,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettingsStore } from "../stores/settingsStore";
import { api } from "../services/api";
import type {
  ProviderInfo,
  LLMProviderEntry,
  LLMProviderType,
  LLMConfig,
  LLMTestResponse,
  OllamaStatus,
} from "../types";

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

export default function SettingsPage() {
  const {
    backendUrl,
    musicProvider,
    setBackendUrl,
    setMusicProvider,
  } = useSettingsStore();

  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [musicProviders, setMusicProviders] = useState<ProviderInfo[]>([]);

  // LLM config state
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
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
      await api.healthCheck();
      setHealthOk(true);
    } catch {
      setHealthOk(false);
    }
    try {
      const [config, music] = await Promise.all([
        api.getLLMConfig(),
        api.getProviders("music"),
      ]);
      setLlmConfig(config);
      setMusicProviders(Array.isArray(music) ? music : []);
    } catch {
      /* backend might not be running */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const checkHealth = async () => {
    setTesting(true);
    try {
      await api.healthCheck();
      setHealthOk(true);
    } catch {
      setHealthOk(false);
    } finally {
      setTesting(false);
    }
  };

  // --- LLM Provider CRUD ---

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
      // If Ollama returns models, auto-fill
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

    // Ensure router default exists
    const router = { ...llmConfig.router };
    if (!router.default && newProviders.length > 0 && models.length > 0) {
      router.default = `${entry.name}:${models[0]}`;
    }

    try {
      const updated = await api.updateLLMConfig({
        providers: newProviders,
        router,
      });
      setLlmConfig(updated);
      closeForm();
    } catch {
      /* show nothing for now */
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (index: number) => {
    if (!llmConfig) return;
    const name = llmConfig.providers[index].name;
    const newProviders = llmConfig.providers.filter((_, i) => i !== index);

    // Clean router entries that reference deleted provider
    const router = { ...llmConfig.router };
    for (const [key, val] of Object.entries(router)) {
      if (val.startsWith(`${name}:`)) {
        router[key] = "";
      }
    }

    setSaving(true);
    try {
      const updated = await api.updateLLMConfig({
        providers: newProviders,
        router,
      });
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

  // Build all available model options for router dropdowns
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
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-1">
            Configure your HikariWave instance
          </p>
        </div>

        {/* ---- Connection Section ---- */}
        <SectionHeader icon={Server} title="Backend Connection" status={healthOk} />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
          <label className="block text-xs font-medium text-text-secondary mb-2">
            API Base URL
          </label>
          <div className="flex gap-2">
            <input
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-lg border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300
                         focus:border-primary-400"
            />
            <button
              onClick={checkHealth}
              disabled={testing}
              className="px-4 py-2 rounded-lg bg-primary-50 text-primary-700
                         text-sm font-medium hover:bg-primary-100
                         transition-colors cursor-pointer disabled:opacity-50
                         flex items-center gap-1.5"
            >
              {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Test Connection
            </button>
          </div>
          {healthOk !== null && (
            <p className={`text-xs mt-2 ${healthOk ? "text-green-600" : "text-red-500"}`}>
              {healthOk
                ? "Connected successfully"
                : "Connection failed -- check the URL and backend"}
            </p>
          )}
        </motion.div>

        {/* ---- LLM Providers Section ---- */}
        <SectionHeader icon={Brain} title="LLM Providers" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
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
                  isDefault={llmConfig.router.default?.startsWith(`${p.name}:`)}
                  onEdit={() => openEditForm(idx)}
                  onDelete={() => handleDeleteProvider(idx)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">
              {healthOk === false
                ? "Backend not reachable"
                : "No LLM providers configured"}
            </p>
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
        </motion.div>

        {/* ---- Add/Edit Provider Modal ---- */}
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

        {/* ---- Router Config Section ---- */}
        {llmConfig && llmConfig.providers.length > 0 && (
          <>
            <SectionHeader icon={Globe} title="LLM Task Router" />
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="bg-white rounded-xl border border-border shadow-sm p-5"
            >
              <p className="text-xs text-text-tertiary mb-4">
                Choose which provider and model handles each task type.
              </p>
              <div className="space-y-3">
                {ROUTER_TASKS.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-3">
                    <label className="text-sm font-medium text-text-secondary w-28
                                      flex-shrink-0">
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
            </motion.div>
          </>
        )}

        {/* ---- Music Provider Section ---- */}
        <SectionHeader icon={Cpu} title="Music Provider" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-text-tertiary" />
              <span className="text-sm text-text-tertiary ml-2">Loading...</span>
            </div>
          ) : musicProviders.length > 0 ? (
            <div className="space-y-2">
              {musicProviders.map((p) => (
                <MusicProviderCard
                  key={p.name}
                  provider={p}
                  selected={musicProvider === p.name}
                  onSelect={() => setMusicProvider(p.name)}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary">
              {healthOk === false
                ? "Backend not reachable"
                : "Connect to backend to see providers"}
            </p>
          )}
        </motion.div>

        {/* ---- About Section ---- */}
        <SectionHeader icon={Info} title="About" />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-border shadow-sm p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl bg-gradient-to-br
                          from-primary-500 to-primary-700
                          flex items-center justify-center"
            >
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">HikariWave</p>
              <p className="text-xs text-text-tertiary">v0.1.0</p>
            </div>
          </div>
          <p className="text-xs text-text-tertiary leading-relaxed">
            AI-powered music generation desktop app. Built with React, Tauri, and love
            for music.
          </p>
        </motion.div>
      </div>
    </div>
  );
}

/* ---- Sub-components ---- */

function SectionHeader({
  icon: Icon,
  title,
  status,
}: {
  icon: typeof Server;
  title: string;
  status?: boolean | null;
}) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <Icon className="w-4 h-4 text-primary-600" />
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      {status === true && (
        <span className="ml-auto flex items-center gap-1 text-[11px] text-green-600">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Connected
        </span>
      )}
      {status === false && (
        <span className="ml-auto flex items-center gap-1 text-[11px] text-red-500">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
          Disconnected
        </span>
      )}
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

function MusicProviderCard({
  provider,
  selected,
  onSelect,
}: {
  provider: ProviderInfo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 rounded-lg border text-sm
                  transition-all cursor-pointer flex items-center gap-3 ${
        selected
          ? "border-primary-300 bg-primary-50"
          : "border-border hover:bg-surface-secondary"
      }`}
    >
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          provider.is_active ? "bg-green-500" : "bg-border"
        }`}
      />
      <div className="flex-1 min-w-0">
        <span className="font-medium">{provider.name}</span>
        <p className="text-xs text-text-tertiary truncate mt-0.5">
          {(provider.models ?? []).join(", ") || "No models listed"}
        </p>
      </div>
      {selected && (
        <CheckCircle className="w-4 h-4 text-primary-600 flex-shrink-0" />
      )}
    </button>
  );
}

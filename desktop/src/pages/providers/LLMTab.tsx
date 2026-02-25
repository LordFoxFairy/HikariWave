import {useCallback, useEffect, useState} from "react";
import {AnimatePresence} from "framer-motion";
import {Brain, ChevronDown, Globe, Loader2, Pencil, Plus, Trash2,} from "lucide-react";
import {useTranslation} from "react-i18next";
import {api} from "../../services/api";
import {SectionHeader} from "../../components/providers/SectionHeader";
import {ProviderFormModal} from "../../components/providers/ProviderFormModal";
import ConfirmDialog from "../../components/ConfirmDialog";
import {
    DEFAULT_URLS,
    EMPTY_PROVIDER,
    LLM_ROUTER_TASKS,
    PROVIDER_TYPE_COLORS,
    PROVIDER_TYPE_LABEL_KEYS,
} from "../../constants/providerOptions";
import type {LLMConfig, LLMProviderEntry, LLMProviderType, LLMTestResponse,} from "../../types";

export function LLMTab() {
    const {t} = useTranslation();
    const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [formData, setFormData] = useState<LLMProviderEntry>({...EMPTY_PROVIDER});
    const [formModels, setFormModels] = useState("");
    const [testResult, setTestResult] = useState<LLMTestResponse | null>(null);
    const [testingProvider, setTestingProvider] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
    const [errorToast, setErrorToast] = useState<string | null>(null);

    // Auto-dismiss error toast
    useEffect(() => {
        if (!errorToast) return;
        const timer = setTimeout(() => setErrorToast(null), 4000);
        return () => clearTimeout(timer);
    }, [errorToast]);

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
        setFormData({...EMPTY_PROVIDER});
        setFormModels("");
        setTestResult(null);
        setEditingIndex(null);
        setShowAddForm(true);
    };

    const openEditForm = (index: number) => {
        if (!llmConfig) return;
        const p = llmConfig.providers[index];
        setFormData({...p});
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
                name: formData.name,
            });
            setTestResult(result);
            if (result.success && result.models.length > 0 && !formModels.trim()) {
                setFormModels(result.models.join(", "));
                setFormData((d) => ({...d, models: result.models}));
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
        const entry: LLMProviderEntry = {...formData, models};
        const newProviders = [...llmConfig.providers];
        if (editingIndex !== null) {
            newProviders[editingIndex] = entry;
        } else {
            newProviders.push(entry);
        }
        const router = {...llmConfig.router};
        if (!router.default && newProviders.length > 0 && models.length > 0) {
            router.default = `${entry.name}:${models[0]}`;
        }
        try {
            const updated = await api.updateLLMConfig({providers: newProviders, router});
            setLlmConfig(updated);
            closeForm();
        } catch {
            setErrorToast(t("providers.saveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteProvider = async (index: number) => {
        if (!llmConfig) return;
        const name = llmConfig.providers[index].name;
        const newProviders = llmConfig.providers.filter((_, i) => i !== index);
        const router = {...llmConfig.router};
        for (const [key, val] of Object.entries(router)) {
            if (val.startsWith(`${name}:`)) {
                router[key] = "";
            }
        }
        setSaving(true);
        try {
            const updated = await api.updateLLMConfig({providers: newProviders, router});
            setLlmConfig(updated);
        } catch {
            setErrorToast(t("providers.deleteFailed"));
        } finally {
            setSaving(false);
        }
    };

    const handleRouterChange = async (task: string, value: string) => {
        if (!llmConfig) return;
        const router = {...llmConfig.router, [task]: value};
        setSaving(true);
        try {
            const updated = await api.updateLLMConfig({
                providers: llmConfig.providers,
                router,
            });
            setLlmConfig(updated);
        } catch {
            setErrorToast(t("providers.routerSaveFailed"));
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

    return (
        <div className="space-y-5">
            {/* Provider Cards */}
            <SectionHeader icon={Brain} title={t("providers.llmProviders")}/>
            <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                {loading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-text-tertiary"/>
                        <span className="text-sm text-text-tertiary ml-2">{t("providers.loading")}</span>
                    </div>
                ) : llmConfig && llmConfig.providers.length > 0 ? (
                    <div className="space-y-3">
                        {llmConfig.providers.map((p, idx) => (
                            <LLMProviderCard
                                key={`${p.name}-${idx}`}
                                provider={p}
                                isDefault={llmConfig.router.default?.startsWith(`${p.name}:`) ?? false}
                                onEdit={() => openEditForm(idx)}
                                onDelete={() => setDeleteConfirmIndex(idx)}
                            />
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-text-tertiary">{t("providers.noLLMProviders")}</p>
                )}

                {/* Add provider button */}
                <div className="mt-4 pt-4 border-t border-border">
                    <button
                        onClick={openAddForm}
                        className="flex items-center gap-1.5 text-sm text-primary-600
                       hover:text-primary-700 font-medium cursor-pointer"
                    >
                        <Plus className="w-4 h-4"/>
                        {t("providers.addProvider")}
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
                    <SectionHeader icon={Globe} title={t("providers.llmTaskRouter")}/>
                    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                        <p className="text-xs text-text-tertiary mb-4">
                            {t("providers.chooseProviderModel")}
                        </p>
                        <div className="space-y-3">
                            {LLM_ROUTER_TASKS.map(({key, labelKey}) => (
                                <div key={key} className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-text-secondary w-28 flex-shrink-0">
                                        {t(labelKey)}
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
                                            <option value="">{t("providers.notSet")}</option>
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
                                <Loader2 className="w-3 h-3 animate-spin"/>
                                {t("providers.saving")}
                            </div>
                        )}
                    </div>
                </>
            )}

            <ConfirmDialog
                open={deleteConfirmIndex !== null}
                title={t("providers.deleteProvider")}
                message={t("providers.deleteProviderMessage")}
                onConfirm={() => {
                    if (deleteConfirmIndex !== null) {
                        handleDeleteProvider(deleteConfirmIndex);
                    }
                    setDeleteConfirmIndex(null);
                }}
                onCancel={() => setDeleteConfirmIndex(null)}
            />

            {/* Error toast */}
            <AnimatePresence>
                {errorToast && (
                    <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-red-50
                        border border-red-200 text-sm text-red-700 shadow-lg">
                        {errorToast}
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ---- LLM Provider Card (local to this tab) ----

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
    const {t} = useTranslation();
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
            {t(PROVIDER_TYPE_LABEL_KEYS[provider.type])}
          </span>
                    {isDefault && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium
                             bg-primary-100 text-primary-700">
              {t("providers.default")}
            </span>
                    )}
                </div>
                <p className="text-xs text-text-tertiary truncate">
                    {provider.base_url || t("providers.noUrl")}
                </p>
                <p className="text-xs text-text-tertiary truncate mt-0.5">
                    {provider.models.length > 0
                        ? provider.models.join(", ")
                        : t("providers.noModelsConfigured")}
                </p>
            </div>
            <div className="flex gap-1 flex-shrink-0">
                <button
                    onClick={onEdit}
                    className="p-1.5 rounded-md hover:bg-surface-tertiary
                     text-text-tertiary hover:text-text-secondary
                     transition-colors cursor-pointer"
                    title={t("providers.editProvider")}
                >
                    <Pencil className="w-3.5 h-3.5"/>
                </button>
                <button
                    onClick={onDelete}
                    className="p-1.5 rounded-md hover:bg-red-50
                     text-text-tertiary hover:text-red-500
                     transition-colors cursor-pointer"
                    title={t("common.delete")}
                >
                    <Trash2 className="w-3.5 h-3.5"/>
                </button>
            </div>
        </div>
    );
}

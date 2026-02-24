import {useTranslation} from "react-i18next";
import {motion} from "framer-motion";
import {AlertCircle, CheckCircle, Loader2, X, Zap,} from "lucide-react";
import {DEFAULT_URLS, PROVIDER_TYPE_LABEL_KEYS,} from "../../constants/providerOptions";
import type {LLMProviderEntry, LLMProviderType, LLMTestResponse,} from "../../types";

interface ProviderFormModalProps {
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
}

export function ProviderFormModal({
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
                                  }: ProviderFormModalProps) {
    const {t} = useTranslation();
    return (
        <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <motion.div
                initial={{opacity: 0, scale: 0.95, y: 10}}
                animate={{opacity: 1, scale: 1, y: 0}}
                exit={{opacity: 0, scale: 0.95, y: 10}}
                className="bg-white rounded-xl border border-border shadow-xl p-6
                   w-full max-w-md mx-4"
            >
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-semibold text-text-primary">
                        {editingIndex !== null ? t("providers.editProvider") : t("providers.addProvider")}
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-md hover:bg-surface-tertiary
                       text-text-tertiary cursor-pointer"
                    >
                        <X className="w-4 h-4"/>
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Provider type */}
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            {t("providers.type")}
                        </label>
                        <div className="flex gap-2">
                            {(Object.keys(PROVIDER_TYPE_LABEL_KEYS) as LLMProviderType[]).map((pt) => (
                                <button
                                    key={pt}
                                    onClick={() => onTypeChange(pt)}
                                    className={`flex-1 px-3 py-2 rounded-lg border text-xs
                              font-medium transition-colors cursor-pointer ${
                                        formData.type === pt
                                            ? "border-primary-400 bg-primary-50 text-primary-700"
                                            : "border-border text-text-secondary hover:bg-surface-secondary"
                                    }`}
                                >
                                    {t(PROVIDER_TYPE_LABEL_KEYS[pt])}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Name */}
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            {t("providers.name")}
                        </label>
                        <input
                            value={formData.name}
                            onChange={(e) =>
                                onFormDataChange((d) => ({...d, name: e.target.value}))
                            }
                            placeholder={t("providers.namePlaceholder")}
                            className="w-full px-3 py-2 rounded-lg border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300"
                        />
                    </div>

                    {/* Base URL */}
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            {t("providers.baseUrl")}
                        </label>
                        <input
                            value={formData.base_url}
                            onChange={(e) =>
                                onFormDataChange((d) => ({...d, base_url: e.target.value}))
                            }
                            placeholder={DEFAULT_URLS[formData.type] || "https://api.example.com/v1"}
                            className="w-full px-3 py-2 rounded-lg border border-border
                         bg-surface-secondary text-sm focus:outline-none
                         focus:ring-2 focus:ring-primary-300"
                        />
                    </div>

                    {/* API Key */}
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            {t("providers.apiKey")}
                        </label>
                        <input
                            type="password"
                            value={formData.api_key}
                            onChange={(e) =>
                                onFormDataChange((d) => ({...d, api_key: e.target.value}))
                            }
                            placeholder="sk-..."
                            className="w-full px-3 py-2 rounded-lg border border-border
                           bg-surface-secondary text-sm focus:outline-none
                           focus:ring-2 focus:ring-primary-300"
                        />
                    </div>

                    {/* Models */}
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            {t("providers.models")}
                        </label>
                        <input
                            value={formModels}
                            onChange={(e) => onFormModelsChange(e.target.value)}
                            placeholder={t("providers.modelsPlaceholder")}
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
                                <Loader2 className="w-3 h-3 animate-spin"/>
                            ) : (
                                <Zap className="w-3 h-3"/>
                            )}
                            {t("providers.testConnection")}
                        </button>
                        {testResult && (
                            <span
                                className={`text-xs flex items-center gap-1 ${
                                    testResult.success ? "text-green-600" : "text-red-500"
                                }`}
                            >
                {testResult.success ? (
                    <CheckCircle className="w-3 h-3"/>
                ) : (
                    <AlertCircle className="w-3 h-3"/>
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
                            {t("common.cancel")}
                        </button>
                        <button
                            onClick={onSave}
                            disabled={saving || !formData.name.trim()}
                            className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm
                         font-medium hover:bg-primary-700 transition-colors
                         cursor-pointer disabled:opacity-50
                         flex items-center gap-1.5"
                        >
                            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin"/>}
                            {editingIndex !== null ? t("providers.update") : t("providers.add")}
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

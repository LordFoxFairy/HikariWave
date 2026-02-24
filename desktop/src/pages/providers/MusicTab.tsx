import {useCallback, useEffect, useRef, useState} from "react";
import {ChevronDown, Download, Globe, Loader2, Music, Search, Trash2, Zap,} from "lucide-react";
import {useTranslation} from "react-i18next";
import {useProviderStore} from "../../stores/providerStore";
import {api} from "../../services/api";
import {SectionHeader} from "../../components/providers/SectionHeader";
import {MarketplaceSection} from "../../components/providers/MarketplaceSection";
import ConfirmDialog from "../../components/ConfirmDialog";
import {MUSIC_ROUTER_TASKS} from "../../constants/providerOptions";
import type {MusicProviderConfig, MusicProviderStatus} from "../../types";

export function MusicTab() {
    const {t} = useTranslation();
    const {
        downloads,
        refreshDownloads,
        refreshCache,
        deleteCache,
    } = useProviderStore();

    const [musicConfig, setMusicConfig] = useState<MusicProviderConfig | null>(null);
    const [providerStatuses, setProviderStatuses] = useState<MusicProviderStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [downloading, setDownloading] = useState<Set<string>>(new Set());
    const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
    const [deleteConfirm, setDeleteConfirm] = useState<{
        providerIdx: number;
        modelIdx: number;
        modelId: string;
        isDownloaded: boolean;
    } | null>(null);
    const [errorToast, setErrorToast] = useState<string | null>(null);

    // Auto-dismiss error toast
    useEffect(() => {
        if (!errorToast) return;
        const timer = setTimeout(() => setErrorToast(null), 4000);
        return () => clearTimeout(timer);
    }, [errorToast]);

    const loadProviderStatuses = useCallback(async () => {
        try {
            const res = await api.listMusicProviders();
            setProviderStatuses(res.providers);
        } catch {
            /* backend might not support this endpoint yet */
        }
    }, []);

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
        loadProviderStatuses();
        refreshDownloads();
        refreshCache();
    }, [loadConfig, loadProviderStatuses, refreshDownloads, refreshCache]);

    // Poll active downloads — refresh both progress and provider statuses
    useEffect(() => {
        const hasActive = downloads.some(
            (d) => d.status === "pending" || d.status === "downloading",
        );
        if (hasActive) {
            pollRef.current = setInterval(() => {
                refreshDownloads();
                loadProviderStatuses();
            }, 2000);
        }
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [downloads, refreshDownloads, loadProviderStatuses]);

    // All model options for router dropdowns
    const allModelOptions: { label: string; value: string }[] = [];
    if (musicConfig) {
        for (const p of musicConfig.providers) {
            for (const m of p.models) {
                allModelOptions.push({
                    label: m.model_id || `${p.name} / ${m.name}`,
                    value: `${p.name}:${m.name}`,
                });
            }
        }
    }

    const handleRouterChange = async (task: string, value: string) => {
        if (!musicConfig) return;
        const router = {...musicConfig.router, [task]: value};
        setSaving(true);
        try {
            const updated = await api.updateMusicConfig({
                providers: musicConfig.providers,
                router,
            });
            setMusicConfig(updated);
        } catch {
            setErrorToast(t("providers.routerSaveFailed"));
        } finally {
            setSaving(false);
        }
    };

    const handleActivateModel = async (providerName: string, modelName: string) => {
        const key = `${providerName}:${modelName}`;
        await handleRouterChange("default", key);
    };

    // Delete behavior:
    // - Downloaded model → clear cached data only (stays in config, shows "Not Downloaded")
    // - Not downloaded model → remove from config entirely
    const handleDeleteModel = async (providerIdx: number, modelIdx: number, modelId: string, isDownloaded: boolean) => {
        if (!musicConfig) return;

        if (isDownloaded) {
            // Clear cached download data only — model stays in yaml config
            try {
                await deleteCache(modelId);
                await loadProviderStatuses();
            } catch {
                setErrorToast(t("providers.deleteFailed"));
            }
        } else {
            // Not downloaded — remove from config entirely
            const newProviders = musicConfig.providers.map((p, pi) => {
                if (pi !== providerIdx) return p;
                return {...p, models: p.models.filter((_, mi) => mi !== modelIdx)};
            });
            setSaving(true);
            try {
                const updated = await api.updateMusicConfig({
                    providers: newProviders,
                    router: musicConfig.router,
                });
                setMusicConfig(updated);
            } catch {
                setErrorToast(t("providers.deleteFailed"));
            } finally {
                setSaving(false);
            }
        }
    };

    const isModelDownloaded = (providerName: string): boolean => {
        const status = providerStatuses.find((s) => s.name === providerName);
        return status?.is_downloaded ?? false;
    };

    const getModelDownload = (modelId: string) => {
        return downloads.find(
            (d) => d.repo_id === modelId && (d.status === "pending" || d.status === "downloading"),
        );
    };

    const handleDownloadModel = async (modelId: string) => {
        if (downloading.has(modelId)) return;
        setDownloading((prev) => new Set(prev).add(modelId));
        try {
            await api.downloadModel(modelId);
            refreshDownloads();
        } catch {
            setErrorToast(t("providers.downloadFailed"));
        } finally {
            setDownloading((prev) => {
                const next = new Set(prev);
                next.delete(modelId);
                return next;
            });
        }
    };

    // When a model is downloaded from the marketplace, add it to the music config
    // so it appears in the registered models list
    const handleMarketplaceDownload = async (repoId: string) => {
        if (!musicConfig) {
            await loadConfig();
        }
        const config = musicConfig ?? {providers: [], router: {}};
        // Check if model already exists in config
        const alreadyExists = config.providers.some((p) =>
            p.models.some((m) => m.model_id === repoId),
        );
        if (alreadyExists) return;

        // Add to a "huggingface" provider group, creating one if needed
        let hfProvider = config.providers.find((p) => p.type === "huggingface");
        let newProviders;
        const modelName = repoId.split("/").pop() || repoId;
        if (hfProvider) {
            newProviders = config.providers.map((p) =>
                p === hfProvider
                    ? {...p, models: [...p.models, {name: modelName, model_id: repoId}]}
                    : p,
            );
        } else {
            newProviders = [
                ...config.providers,
                {
                    name: "huggingface",
                    type: "huggingface",
                    models: [{name: modelName, model_id: repoId}],
                },
            ];
        }
        try {
            const updated = await api.updateMusicConfig({
                providers: newProviders,
                router: config.router,
            });
            setMusicConfig(updated);
        } catch {
            setErrorToast(t("providers.saveFailed"));
        }
    };

    return (
        <div className="space-y-5">
            {/* Registered Music Models */}
            <SectionHeader icon={Music} title={t("providers.musicModels")}/>
            <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                {loading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-text-tertiary"/>
                        <span className="text-sm text-text-tertiary ml-2">{t("providers.loading")}</span>
                    </div>
                ) : musicConfig && musicConfig.providers.length > 0 ? (
                    <div className="space-y-2">
                        {musicConfig.providers.map((provider, pi) =>
                            provider.models.map((model, mi) => {
                                const key = `${provider.name}:${model.name}`;
                                const isRouted = Object.values(musicConfig.router).includes(key);
                                const downloaded = isModelDownloaded(`${provider.name}:${model.name}`);
                                const activeDownload = getModelDownload(model.model_id);

                                return (
                                    <div
                                        key={`${pi}-${mi}`}
                                        className={`px-4 py-3 rounded-lg border text-sm transition-all ${
                                            isRouted
                                                ? "border-primary-300 bg-primary-50/50"
                                                : "border-border hover:bg-surface-secondary"
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span
                                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                    isRouted ? "bg-green-500" : "bg-border"
                                                }`}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-medium text-text-primary">{model.model_id || model.name}</span>
                                                    {isRouted && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium
                                                            bg-primary-100 text-primary-700">
                                                            {t("providers.active")}
                                                        </span>
                                                    )}
                                                    {downloaded ? (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium
                                                            bg-green-100 text-green-700">
                                                            {t("providers.downloaded")}
                                                        </span>
                                                    ) : activeDownload ? (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium
                                                            bg-blue-100 text-blue-700 animate-pulse">
                                                            {t("providers.downloading")}
                                                        </span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium
                                                            bg-orange-100 text-orange-700">
                                                            {t("providers.download")}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {!downloaded && !activeDownload && (
                                                <button
                                                    onClick={() => handleDownloadModel(model.model_id)}
                                                    disabled={downloading.has(model.model_id)}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                                                        border border-orange-200 bg-orange-50
                                                        text-orange-700 text-xs font-medium
                                                        hover:bg-orange-100 transition-colors
                                                        cursor-pointer disabled:opacity-50 flex-shrink-0"
                                                    title={t("providers.download")}
                                                >
                                                    {downloading.has(model.model_id) ? (
                                                        <Loader2 className="w-3 h-3 animate-spin"/>
                                                    ) : (
                                                        <Download className="w-3 h-3"/>
                                                    )}
                                                    {t("providers.download")}
                                                </button>
                                            )}
                                            {downloaded && !isRouted && (
                                                <button
                                                    onClick={() => handleActivateModel(provider.name, model.name)}
                                                    disabled={saving}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg
                                                        border border-primary-200 bg-primary-50
                                                        text-primary-700 text-xs font-medium
                                                        hover:bg-primary-100 transition-colors
                                                        cursor-pointer disabled:opacity-50 flex-shrink-0"
                                                    title={t("providers.activate")}
                                                >
                                                    <Zap className="w-3 h-3"/>
                                                    {t("providers.activate")}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => setDeleteConfirm({providerIdx: pi, modelIdx: mi, modelId: model.model_id, isDownloaded: downloaded})}
                                                className="p-1.5 rounded-md hover:bg-red-50
                                                    text-text-tertiary hover:text-red-500
                                                    transition-colors cursor-pointer"
                                                title={downloaded ? t("providers.clearDownload") : t("providers.removeModel")}
                                            >
                                                <Trash2 className="w-3.5 h-3.5"/>
                                            </button>
                                        </div>
                                        {/* Download progress bar */}
                                        {activeDownload && (
                                            <div className="mt-2.5 ml-5">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-[11px] text-text-tertiary">
                                                        {activeDownload.message || t("providers.downloading")}
                                                    </span>
                                                    <span className="text-[11px] font-medium text-primary-600">
                                                        {Math.round(activeDownload.progress)}%
                                                    </span>
                                                </div>
                                                <div className="w-full h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary-500 rounded-full transition-all duration-300"
                                                        style={{width: `${activeDownload.progress}%`}}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            }),
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-text-tertiary">
                        {t("providers.noMusicModels")}
                    </p>
                )}
                {saving && (
                    <div className="flex items-center gap-1.5 mt-3 text-xs text-text-tertiary">
                        <Loader2 className="w-3 h-3 animate-spin"/>
                        {t("providers.saving")}
                    </div>
                )}
            </div>

            {/* Music Router Config */}
            {musicConfig && allModelOptions.length > 0 && (
                <>
                    <SectionHeader icon={Globe} title={t("providers.musicTaskRouter")}/>
                    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                        <p className="text-xs text-text-tertiary mb-4">
                            {t("providers.chooseModelTask")}
                        </p>
                        <div className="space-y-3">
                            {MUSIC_ROUTER_TASKS.map(({key, labelKey}) => (
                                <div key={key} className="flex items-center gap-3">
                                    <label className="text-sm font-medium text-text-secondary w-36 flex-shrink-0">
                                        {t(labelKey)}
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

            {/* Model Marketplace */}
            <SectionHeader icon={Search} title={t("providers.modelMarketplace")}/>
            <MarketplaceSection
                pipelineTag="text-to-audio"
                searchPlaceholder={t("providers.searchMusicModels")}
                emptyMessage={t("providers.searchHuggingface")}
                onModelDownloaded={handleMarketplaceDownload}
            />

            <ConfirmDialog
                open={deleteConfirm !== null}
                title={deleteConfirm?.isDownloaded ? t("providers.clearDownloadTitle") : t("providers.deleteModel")}
                message={deleteConfirm?.isDownloaded ? t("providers.clearDownloadMessage") : t("providers.deleteModelMessage")}
                onConfirm={() => {
                    if (deleteConfirm) {
                        handleDeleteModel(deleteConfirm.providerIdx, deleteConfirm.modelIdx, deleteConfirm.modelId, deleteConfirm.isDownloaded);
                    }
                    setDeleteConfirm(null);
                }}
                onCancel={() => setDeleteConfirm(null)}
            />

            {/* Error toast */}
            {errorToast && (
                <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-red-50
                    border border-red-200 text-sm text-red-700 shadow-lg">
                    {errorToast}
                </div>
            )}
        </div>
    );
}

import {useCallback, useEffect, useRef, useState} from "react";
import {CheckCircle, ChevronDown, Globe, HardDrive, Loader2, Music, Plus, Search, Trash2,} from "lucide-react";
import {useTranslation} from "react-i18next";
import {useProviderStore} from "../../stores/providerStore";
import {api} from "../../services/api";
import {SectionHeader} from "../../components/providers/SectionHeader";
import {MarketplaceSection} from "../../components/providers/MarketplaceSection";
import {MUSIC_ROUTER_TASKS} from "../../constants/providerOptions";
import type {MusicModelEntry, MusicProviderConfig} from "../../types";

export function MusicTab() {
    const {t} = useTranslation();
    const {
        downloads,
        refreshDownloads,
        cachedModels,
        refreshCache,
        deleteCache,
    } = useProviderStore();

    const [musicConfig, setMusicConfig] = useState<MusicProviderConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
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
        const router = {...musicConfig.router, [task]: value};
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
            /* noop */
        } finally {
            setSaving(false);
        }
    };

    const handleAddToConfig = async (repoId: string) => {
        if (!musicConfig) return;
        const modelName = repoId.split("/").pop() || repoId;
        const newModel: MusicModelEntry = {name: modelName, model_id: repoId};

        let newProviders = [...musicConfig.providers];
        if (newProviders.length === 0) {
            newProviders = [{name: "local", type: "local_gpu", models: [newModel]}];
        } else {
            const alreadyExists = newProviders.some((p) =>
                p.models.some((m) => m.model_id === repoId || m.name === modelName),
            );
            if (alreadyExists) return;
            newProviders = newProviders.map((p, i) =>
                i === 0 ? {...p, models: [...p.models, newModel]} : p,
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

    return (
        <div className="space-y-5">
            {/* Registered Music Models */}
            <SectionHeader icon={Music} title="Music Models"/>
            <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                {loading ? (
                    <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-text-tertiary"/>
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
                                                <Trash2 className="w-3.5 h-3.5"/>
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
                        <Loader2 className="w-3 h-3 animate-spin"/>
                        Saving...
                    </div>
                )}
            </div>

            {/* Music Router Config */}
            {musicConfig && allModelOptions.length > 0 && (
                <>
                    <SectionHeader icon={Globe} title="Music Task Router"/>
                    <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                        <p className="text-xs text-text-tertiary mb-4">
                            Choose which model handles each generation task.
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
                                <Loader2 className="w-3 h-3 animate-spin"/>
                                Saving...
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Model Marketplace */}
            <SectionHeader icon={Search} title="Model Marketplace"/>
            <MarketplaceSection
                pipelineTag="text-to-audio"
                searchPlaceholder="Search music generation models..."
                emptyMessage="Search for music generation models from HuggingFace"
            />

            {/* Local Models / Cache */}
            <SectionHeader icon={HardDrive} title="Local Models"/>
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
                                    <HardDrive className="w-4 h-4 text-text-tertiary flex-shrink-0"/>
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
                      <CheckCircle className="w-3.5 h-3.5"/>
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
                                            <Plus className="w-3 h-3"/>
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
                                        <Trash2 className="w-3.5 h-3.5"/>
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

import {useCallback, useEffect, useState} from "react";
import {motion} from "framer-motion";
import {CheckCircle, Download, Loader2} from "lucide-react";
import {useTranslation} from "react-i18next";
import {useProviderStore} from "../../stores/providerStore";
import {api} from "../../services/api";
import type {AceStepModelInfo, DownloadProgress} from "../../types";

export function AceStepSection() {
    const {t} = useTranslation();
    const {downloads, startDownload, refreshDownloads, cachedModels, refreshCache} = useProviderStore();
    const [models, setModels] = useState<AceStepModelInfo[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const data = await api.getAceStepModels();
            setModels(data);
        } catch {
            /* endpoint may not be available yet */
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // Refresh is_cached status when cached models change
    useEffect(() => {
        if (!loading) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cachedModels]);

    const cachedRepoIds = new Set(cachedModels.map((c) => c.repo_id));

    const activeDownloadFor = (repoId: string): DownloadProgress | undefined =>
        downloads.find(
            (d) => d.repo_id === repoId && (d.status === "pending" || d.status === "downloading"),
        );

    const handleDownload = async (repoId: string) => {
        await startDownload(repoId);
        refreshDownloads();
        refreshCache();
    };

    const lmModels = models.filter((m) => m.category === "lm");
    const ditModels = models.filter((m) => m.category === "dit");

    if (loading) {
        return (
            <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-text-tertiary"/>
                    <span className="text-sm text-text-tertiary ml-2">{t("providers.loading")}</span>
                </div>
            </div>
        );
    }

    if (models.length === 0) return null;

    return (
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-5">
            {/* Language Models */}
            {lmModels.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
                        {t("providers.aceStepLm")}
                    </h3>
                    <p className="text-[11px] text-text-tertiary mb-3">
                        {t("providers.aceStepLmDesc")}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {lmModels.map((m) => (
                            <AceStepCard
                                key={m.repo_id}
                                model={m}
                                isCached={m.is_cached || cachedRepoIds.has(m.repo_id)}
                                activeDownload={activeDownloadFor(m.repo_id)}
                                onDownload={() => handleDownload(m.repo_id)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* DiT Variants */}
            {ditModels.length > 0 && (
                <div>
                    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
                        {t("providers.aceStepDit")}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {ditModels.map((m) => (
                            <AceStepCard
                                key={m.repo_id}
                                model={m}
                                isCached={m.is_cached || cachedRepoIds.has(m.repo_id)}
                                activeDownload={activeDownloadFor(m.repo_id)}
                                onDownload={() => handleDownload(m.repo_id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function AceStepCard({
    model,
    isCached,
    activeDownload,
    onDownload,
}: {
    model: AceStepModelInfo;
    isCached: boolean;
    activeDownload?: DownloadProgress;
    onDownload: () => void;
}) {
    const {t} = useTranslation();
    const isDownloading = !!activeDownload;
    const progress = activeDownload?.progress ?? 0;

    return (
        <div className="border border-border rounded-xl p-4 hover:shadow-md transition-shadow
                    bg-white flex flex-col gap-2.5">
            <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate" title={model.name}>
                    {model.name}
                </p>
                <p className="text-[11px] text-text-tertiary mt-0.5">{model.description}</p>
            </div>

            <div className="flex items-center gap-3 text-[11px] text-text-tertiary">
                <span>{model.size_str}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    model.category === "lm"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                }`}>
                    {model.category.toUpperCase()}
                </span>
            </div>

            {isCached ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mt-auto">
                    <CheckCircle className="w-3.5 h-3.5"/>
                    {t("providers.downloaded")}
                </div>
            ) : isDownloading ? (
                <div className="mt-auto">
                    <div className="flex items-center justify-between text-[11px] text-text-tertiary mb-1">
                        <span>{t("providers.downloading")}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-primary-100 overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-primary-600"
                            initial={{width: 0}}
                            animate={{width: `${progress}%`}}
                            transition={{duration: 0.3}}
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
                    <Download className="w-3.5 h-3.5"/>
                    {t("providers.download")}
                </button>
            )}
        </div>
    );
}

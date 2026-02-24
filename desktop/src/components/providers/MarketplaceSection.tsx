import {useCallback, useRef, useState} from "react";
import {motion} from "framer-motion";
import {ArrowDownUp, CheckCircle, Download, Heart, Loader2, Search,} from "lucide-react";
import {useTranslation} from "react-i18next";
import {useProviderStore} from "../../stores/providerStore";
import {formatCount, licenseBadgeColor} from "../../constants/providerOptions";
import type {DownloadProgress, HFModelInfo} from "../../types";

interface MarketplaceSectionProps {
    pipelineTag: string;
    searchPlaceholder: string;
    emptyMessage: string;
    onModelDownloaded?: (repoId: string) => void;
}

export function MarketplaceSection({
                                       pipelineTag,
                                       searchPlaceholder,
                                       emptyMessage,
                                       onModelDownloaded,
                                   }: MarketplaceSectionProps) {
    const {t} = useTranslation();
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
    } = useProviderStore();

    const [sortBy, setSortBy] = useState<string>("downloads");
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    const handleSearch = useCallback(
        (q: string) => {
            setSearchQuery(q);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                searchModels(q, pipelineTag, sortBy);
            }, 300);
        },
        [setSearchQuery, searchModels, pipelineTag, sortBy],
    );

    const handleSort = (sort: string) => {
        setSortBy(sort);
        searchModels(searchQuery, pipelineTag, sort);
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
        onModelDownloaded?.(repoId);
    };

    return (
        <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            {/* Search bar */}
            <div className="flex gap-3 mb-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"/>
                    <input
                        value={searchQuery}
                        onChange={(e) => handleSearch(e.target.value)}
                        placeholder={searchPlaceholder}
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
                        <option value="downloads">{t("providers.mostDownloaded")}</option>
                        <option value="likes">{t("providers.mostLiked")}</option>
                        <option value="trending">{t("providers.trending")}</option>
                    </select>
                    <ArrowDownUp className="absolute right-2.5 top-1/2 -translate-y-1/2
                                  w-3.5 h-3.5 text-text-tertiary pointer-events-none"/>
                </div>
            </div>

            {/* Results */}
            {searchLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-text-tertiary"/>
                    <span className="text-sm text-text-tertiary ml-2">{t("providers.searching")}</span>
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
                    {t("providers.noModelsFound", {query: searchQuery})}
                </p>
            ) : (
                <p className="text-sm text-text-tertiary text-center py-8">
                    {emptyMessage}
                </p>
            )}
        </div>
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
    const {t} = useTranslation();
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
          <Download className="w-3 h-3"/>
            {formatCount(model.downloads)}
        </span>
                <span className="flex items-center gap-1">
          <Heart className="w-3 h-3"/>
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

import {useEffect} from "react";
import {HardDrive, ImageIcon, Search} from "lucide-react";
import {useProviderStore} from "../../stores/providerStore";
import {SectionHeader} from "../../components/providers/SectionHeader";
import {MarketplaceSection} from "../../components/providers/MarketplaceSection";
import {CachedModelCard} from "../../components/providers/CachedModelCard";

export function ImageTab() {
    const {
        refreshDownloads,
        cachedModels,
        refreshCache,
        deleteCache,
    } = useProviderStore();

    useEffect(() => {
        refreshCache();
        refreshDownloads();
    }, [refreshCache, refreshDownloads]);

    return (
        <div className="space-y-5">
            {/* Image provider config placeholder */}
            <SectionHeader icon={ImageIcon} title="Image Providers"/>
            <div className="bg-white rounded-xl border border-border shadow-sm p-5">
                <p className="text-sm text-text-tertiary">
                    Image generation providers will be configurable here. Connect an API provider
                    or browse models from the marketplace below.
                </p>
            </div>

            {/* Image Model Marketplace */}
            <SectionHeader icon={Search} title="Image Model Marketplace"/>
            <MarketplaceSection
                pipelineTag="text-to-image"
                searchPlaceholder="Search image generation models..."
                emptyMessage="Search for image generation models from HuggingFace"
            />

            {/* Local cached image models */}
            <SectionHeader icon={HardDrive} title="Local Image Models"/>
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

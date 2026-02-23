import {HardDrive, Trash2} from "lucide-react";
import type {CachedModelInfo} from "../../types";

interface CachedModelCardProps {
    model: CachedModelInfo;
    onDelete: () => void;
}

export function CachedModelCard({model, onDelete}: CachedModelCardProps) {
    return (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border
                    hover:bg-surface-secondary transition-colors">
            <HardDrive className="w-4 h-4 text-text-tertiary flex-shrink-0"/>
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
                <Trash2 className="w-3.5 h-3.5"/>
            </button>
        </div>
    );
}

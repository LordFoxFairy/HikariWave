import type {LucideIcon} from "lucide-react";

interface MetadataCardProps {
    icon: LucideIcon;
    label: string;
    value: string | number | undefined;
}

export default function MetadataCard({icon: Icon, label, value}: MetadataCardProps) {
    if (!value) return null;
    return (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-secondary">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary-500"/>
            </div>
            <div className="min-w-0">
                <p className="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">{label}</p>
                <p className="text-[13px] text-text-primary font-medium truncate">{value}</p>
            </div>
        </div>
    );
}

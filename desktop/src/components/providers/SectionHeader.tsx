import type {LucideIcon} from "lucide-react";

export function SectionHeader({
                                  icon: Icon,
                                  title,
                              }: {
    icon: LucideIcon;
    title: string;
}) {
    return (
        <div className="flex items-center gap-2 pt-2">
            <Icon className="w-4 h-4 text-primary-600"/>
            <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
    );
}

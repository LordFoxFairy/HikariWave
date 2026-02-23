interface LoadingSkeletonProps {
    viewMode: "grid" | "list";
}

export default function LoadingSkeleton({viewMode}: LoadingSkeletonProps) {
    if (viewMode === "list") {
        return (
            <div className="space-y-2">
                {Array.from({length: 6}).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                        <div className="w-10 h-10 bg-surface-tertiary rounded-lg"/>
                        <div className="flex-1 space-y-1.5">
                            <div className="h-4 bg-surface-tertiary rounded-lg w-48"/>
                            <div className="h-3 bg-surface-tertiary rounded w-24"/>
                        </div>
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({length: 6}).map((_, i) => (
                <div
                    key={i}
                    className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden animate-pulse"
                >
                    <div className="h-32 bg-surface-tertiary"/>
                    <div className="p-4 space-y-2.5">
                        <div className="h-4 bg-surface-tertiary rounded-lg w-3/4"/>
                        <div className="flex gap-2">
                            <div className="h-5 bg-surface-tertiary rounded-full w-16"/>
                            <div className="h-5 bg-surface-tertiary rounded-full w-14"/>
                        </div>
                        <div className="h-3 bg-surface-tertiary rounded w-24"/>
                    </div>
                </div>
            ))}
        </div>
    );
}

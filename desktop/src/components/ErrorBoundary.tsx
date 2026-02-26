import {Component, type ErrorInfo, type ReactNode} from "react";
import {AlertTriangle} from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {hasError: false, error: null};
    }

    static getDerivedStateFromError(error: Error): State {
        return {hasError: true, error};
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("ErrorBoundary caught:", error, info.componentStack);
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children;
        }

        return (
            <div className="flex items-center justify-center min-h-screen bg-bg-primary p-6">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4 border border-red-100">
                        <AlertTriangle className="w-7 h-7 text-red-400"/>
                    </div>
                    <p className="text-text-primary font-semibold mb-1">Something went wrong</p>
                    <p className="text-text-tertiary text-[13px] mb-5">
                        {this.state.error?.message || "An unexpected error occurred."}
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                           bg-primary-600 text-white text-sm font-medium
                           hover:bg-primary-700 transition-colors cursor-pointer shadow-sm"
                    >
                        Reload
                    </button>
                </div>
            </div>
        );
    }
}

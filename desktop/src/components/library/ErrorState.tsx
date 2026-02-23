import {Music} from "lucide-react";
import {motion} from "framer-motion";
import {useTranslation} from "react-i18next";

interface ErrorStateProps {
    error: string;
    onRetry: () => void;
}

export default function ErrorState({error, onRetry}: ErrorStateProps) {
    const {t} = useTranslation();
    return (
        <motion.div
            initial={{opacity: 0, y: 12}}
            animate={{opacity: 1, y: 0}}
            className="text-center py-20"
        >
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center
                      mx-auto mb-4 border border-red-100">
                <Music className="w-7 h-7 text-red-400"/>
            </div>
            <p className="text-text-primary font-semibold mb-1">{t("library.connectionError")}</p>
            <p className="text-text-tertiary text-[13px] mb-5">{error}</p>
            <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
                   bg-primary-600 text-white text-sm font-medium
                   hover:bg-primary-700 transition-colors cursor-pointer shadow-sm"
            >
                {t("library.retry")}
            </button>
        </motion.div>
    );
}

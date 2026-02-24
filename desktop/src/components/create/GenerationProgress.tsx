import {useTranslation} from "react-i18next";
import {AnimatePresence, motion} from "framer-motion";
import {X} from "lucide-react";
import {WAVEFORM_RANDOMS} from "../../constants/musicOptions";
import {useCreateStore} from "../../stores/createStore";
import {api} from "../../services/api";

interface GenerationProgressProps {
    progressMessage: string;
    onCancel: () => void;
}

export function GenerationProgress({progressMessage, onCancel}: GenerationProgressProps) {
    const {t} = useTranslation();
    const store = useCreateStore();
    const isGenerating = store.generationStatus === "pending" || store.generationStatus === "processing";

    return (
        <AnimatePresence>
            {isGenerating && (
                <motion.div
                    initial={{opacity: 0, height: 0}}
                    animate={{opacity: 1, height: "auto"}}
                    exit={{opacity: 0, height: 0}}
                    className="overflow-hidden"
                >
                    <div className="bg-white rounded-2xl border border-border shadow-md p-8 text-center">
                        {/* Animated waveform */}
                        <div className="flex items-center justify-center gap-[3px] mb-6 h-16">
                            {WAVEFORM_RANDOMS.map((rand, i) => (
                                <motion.div
                                    key={i}
                                    className="w-1 bg-gradient-to-t from-primary-600 to-accent-400 rounded-full"
                                    animate={{
                                        height: [6, rand.height, 6],
                                    }}
                                    transition={{
                                        duration: rand.duration,
                                        repeat: Infinity,
                                        delay: i * 0.04,
                                        ease: "easeInOut",
                                    }}
                                />
                            ))}
                        </div>

                        <h3 className="text-lg font-semibold text-text-primary mb-1.5">
                            {t("create.creatingYourSong")}
                        </h3>
                        <p className="text-sm text-text-tertiary mb-5">
                            {progressMessage || t("create.aiComposingSpecial")}
                        </p>

                        {/* Progress bar */}
                        <div className="w-full h-1.5 bg-surface-tertiary rounded-full overflow-hidden mb-2">
                            <motion.div
                                className="h-full bg-gradient-to-r from-primary-500 to-accent-400 rounded-full"
                                initial={{width: 0}}
                                animate={{width: `${store.progress}%`}}
                                transition={{duration: 0.5, ease: "easeOut"}}
                            />
                        </div>
                        <p className="text-xs text-text-tertiary tabular-nums">
                            {Math.round(store.progress)}%
                        </p>

                        <button
                            onClick={async () => {
                                if (store.currentTaskId) {
                                    try {
                                        await api.cancelTask(store.currentTaskId);
                                    } catch {
                                        // Best-effort cancel
                                    }
                                }
                                onCancel();
                                store.setGenerationStatus("idle");
                            }}
                            className="mt-5 flex items-center gap-1.5 mx-auto px-4 py-2
                         rounded-lg text-xs font-medium text-text-tertiary
                         hover:text-red-600 hover:bg-red-50
                         transition-colors cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5"/>
                            {t("create.cancel")}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

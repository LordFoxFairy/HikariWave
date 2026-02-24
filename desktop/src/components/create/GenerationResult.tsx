import {forwardRef} from "react";
import {useTranslation} from "react-i18next";
import {AnimatePresence, motion} from "framer-motion";
import {GitBranch, Image, Loader2, Pause, Play, Repeat, RotateCcw, Shuffle, X,} from "lucide-react";
import type {Generation} from "../../types";
import {useCreateStore} from "../../stores/createStore";

interface GenerationResultProps {
    completedGen: Generation | null;
    completedCoverUrl: string | null;
    coverRegenerating: boolean;
    isPlayingThis: boolean;
    showExtendForm: boolean;
    showRemixForm: boolean;
    onPlayPause: () => void;
    onRegenerateCover: () => void;
    onCreateAnother: () => void;
    onToggleExtendForm: () => void;
    onOpenRemixForm: () => void;
    onRetryGenerate: () => void;
    extendRemixNode: React.ReactNode;
}

export const GenerationResult = forwardRef<HTMLDivElement, GenerationResultProps>(
    function GenerationResult(
        {
            completedGen,
            completedCoverUrl,
            coverRegenerating,
            isPlayingThis,
            showExtendForm,
            showRemixForm,
            onPlayPause,
            onRegenerateCover,
            onCreateAnother,
            onToggleExtendForm,
            onOpenRemixForm,
            onRetryGenerate,
            extendRemixNode,
        },
        ref,
    ) {
        const {t} = useTranslation();
        const store = useCreateStore();
        const isCompleted = store.generationStatus === "completed";
        const isFailed = store.generationStatus === "failed";

        return (
            <AnimatePresence>
                {(isCompleted || isFailed) && (
                    <motion.div
                        ref={ref}
                        initial={{opacity: 0, y: 16}}
                        animate={{opacity: 1, y: 0}}
                        exit={{opacity: 0, y: 16}}
                    >
                        {isCompleted ? (
                            <div className="bg-white rounded-2xl border border-border shadow-md p-6 space-y-5">
                                {/* Cover art with regenerate overlay */}
                                <div className="text-center">
                                    {completedCoverUrl ? (
                                        <div className="relative w-36 h-36 rounded-2xl overflow-hidden mx-auto mb-5 shadow-lg
                                    ring-4 ring-primary-100 group/cover">
                                            <img
                                                src={completedCoverUrl}
                                                alt="Cover art"
                                                className={`w-full h-full object-cover transition-opacity ${coverRegenerating ? "opacity-40" : ""}`}
                                            />
                                            {coverRegenerating && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Loader2 className="w-6 h-6 animate-spin text-primary-600"/>
                                                </div>
                                            )}
                                            <button
                                                onClick={onRegenerateCover}
                                                disabled={coverRegenerating}
                                                className="absolute inset-0 flex items-center justify-center bg-black/0
                                   group-hover/cover:bg-black/30 transition-all cursor-pointer
                                   opacity-0 group-hover/cover:opacity-100"
                                            >
                                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                        bg-white/90 text-[11px] font-medium text-text-primary shadow-sm">
                                                    <Image className="w-3 h-3"/>
                                                    {t("create.regenerate")}
                                                </div>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="w-36 h-36 rounded-2xl overflow-hidden mx-auto mb-5 shadow-lg
                                            ring-4 ring-primary-100
                                            bg-gradient-to-br from-primary-400 to-accent-500
                                            flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-6 h-6 text-white/60 animate-spin"/>
                                            <span className="text-[11px] text-white/60 font-medium">
                                                {t("create.generatingCover", "Generating cover...")}
                                            </span>
                                        </div>
                                    )}
                                    <h3 className="text-lg font-bold text-text-primary mb-1">
                                        {completedGen?.title || t("create.songCreated")}
                                    </h3>

                                    {/* Lineage info */}
                                    {completedGen?.parent_id && completedGen?.parent_type && (
                                        <p className="text-[12px] text-text-tertiary flex items-center justify-center gap-1.5 mb-1">
                                            <GitBranch className="w-3 h-3"/>
                                            {completedGen.parent_type === "extend" ? t("create.extendedFrom") : t("create.remixOf")} #{completedGen.parent_id}
                                        </p>
                                    )}

                                    <p className="text-sm text-text-tertiary mb-4">
                                        {t("create.goToLibrary")}
                                    </p>

                                    {/* Play button */}
                                    {completedGen && (
                                        <button
                                            onClick={onPlayPause}
                                            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                                 text-white bg-gradient-to-r from-primary-600 to-accent-500
                                 hover:from-primary-700 hover:to-accent-600
                                 shadow-md shadow-primary-200/50
                                 transition-all cursor-pointer active:scale-[0.97]"
                                        >
                                            {isPlayingThis ? (
                                                <>
                                                    <Pause className="w-4 h-4"/>
                                                    {t("create.pause")}
                                                </>
                                            ) : (
                                                <>
                                                    <Play className="w-4 h-4"/>
                                                    {t("create.playNow")}
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {(completedGen?.lyrics || store.lyrics) && (
                                    <div className="text-left">
                    <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                      {t("create.lyrics")}
                    </span>
                                        <pre className="text-[13px] text-text-primary mt-2 font-mono whitespace-pre-wrap leading-relaxed
                                    bg-surface-secondary rounded-xl p-4 max-h-52 overflow-y-auto border border-border-light">
                      {completedGen?.lyrics || store.lyrics}
                    </pre>
                                    </div>
                                )}

                                {/* Action buttons: Extend, Remix, Regenerate Cover, Create Another */}
                                <div className="flex flex-wrap justify-center gap-2">
                                    <button
                                        onClick={onToggleExtendForm}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium
                               transition-all cursor-pointer border
                               ${showExtendForm
                                            ? "bg-primary-50 text-primary-700 border-primary-200"
                                            : "text-text-secondary bg-white border-border hover:border-primary-200 hover:text-text-primary"}`}
                                    >
                                        <Repeat className="w-3.5 h-3.5"/>
                                        {t("create.extend")}
                                    </button>
                                    <button
                                        onClick={onOpenRemixForm}
                                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium
                               transition-all cursor-pointer border
                               ${showRemixForm
                                            ? "bg-accent-50 text-accent-500 border-accent-200"
                                            : "text-text-secondary bg-white border-border hover:border-accent-200 hover:text-text-primary"}`}
                                    >
                                        <Shuffle className="w-3.5 h-3.5"/>
                                        {t("create.remix")}
                                    </button>
                                    <button
                                        onClick={onRegenerateCover}
                                        disabled={coverRegenerating}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium
                               text-text-secondary bg-white border border-border hover:border-primary-200
                               hover:text-text-primary transition-all cursor-pointer
                               disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {coverRegenerating ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin"/>
                                        ) : (
                                            <Image className="w-3.5 h-3.5"/>
                                        )}
                                        {t("create.regenCover")}
                                    </button>
                                    <button
                                        onClick={onCreateAnother}
                                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-medium
                               text-primary-700 bg-primary-50 hover:bg-primary-100
                               border border-primary-200
                               transition-colors cursor-pointer"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5"/>
                                        {t("create.createAnother")}
                                    </button>
                                </div>

                                {/* Extend/Remix inline forms */}
                                {extendRemixNode}
                            </div>
                        ) : (
                            <div className="bg-white rounded-2xl border border-red-200 shadow-md p-6 text-center">
                                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4
                                border border-red-200">
                                    <X className="w-7 h-7 text-red-500"/>
                                </div>
                                <h3 className="text-lg font-semibold text-text-primary mb-1">
                                    {t("create.generationFailed")}
                                </h3>
                                <p className="text-sm text-text-tertiary mb-6">
                                    {t("create.somethingWrong")}
                                </p>
                                <div className="flex justify-center gap-3">
                                    <button
                                        onClick={() => store.setGenerationStatus("idle")}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                               text-text-secondary bg-white border border-border
                               hover:bg-surface-secondary transition-colors cursor-pointer"
                                    >
                                        {t("create.dismiss")}
                                    </button>
                                    <button
                                        onClick={onRetryGenerate}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                               text-white bg-primary-600 hover:bg-primary-700
                               transition-colors cursor-pointer"
                                    >
                                        <RotateCcw className="w-4 h-4"/>
                                        {t("create.tryAgain")}
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        );
    },
);

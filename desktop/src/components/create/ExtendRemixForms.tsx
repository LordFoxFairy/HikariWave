import {AnimatePresence, motion} from "framer-motion";
import {Loader2, Repeat, Shuffle} from "lucide-react";

interface ExtendFormState {
    prompt: string;
    lyrics: string;
    duration: number;
}

interface RemixFormState {
    prompt: string;
    genre: string;
    mood: string;
    tempo: number | undefined;
    musicalKey: string;
}

interface ExtendRemixFormsProps {
    showExtendForm: boolean;
    showRemixForm: boolean;
    extendForm: ExtendFormState;
    remixForm: RemixFormState;
    loading: boolean;
    onExtendFormChange: (updates: Partial<ExtendFormState>) => void;
    onRemixFormChange: (updates: Partial<RemixFormState>) => void;
    onExtend: () => void;
    onRemix: () => void;
    onCloseExtend: () => void;
    onCloseRemix: () => void;
}

export function ExtendRemixForms({
                                     showExtendForm,
                                     showRemixForm,
                                     extendForm,
                                     remixForm,
                                     loading,
                                     onExtendFormChange,
                                     onRemixFormChange,
                                     onExtend,
                                     onRemix,
                                     onCloseExtend,
                                     onCloseRemix,
                                 }: ExtendRemixFormsProps) {
    return (
        <>
            {/* Extend inline form */}
            <AnimatePresence>
                {showExtendForm && (
                    <motion.div
                        initial={{opacity: 0, height: 0}}
                        animate={{opacity: 1, height: "auto"}}
                        exit={{opacity: 0, height: 0}}
                        className="overflow-hidden"
                    >
                        <div className="bg-surface-secondary rounded-xl border border-border-light p-4 space-y-3">
                            <h4 className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                                <Repeat className="w-3.5 h-3.5 text-primary-500"/>
                                Extend Song
                            </h4>
                            <input
                                type="text"
                                value={extendForm.prompt}
                                onChange={(e) => onExtendFormChange({prompt: e.target.value})}
                                placeholder="Optional: describe how to continue..."
                                className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm
                           placeholder:text-text-tertiary/60 focus:outline-none focus:ring-2
                           focus:ring-primary-200"
                            />
                            <textarea
                                value={extendForm.lyrics}
                                onChange={(e) => onExtendFormChange({lyrics: e.target.value})}
                                placeholder="Optional: additional lyrics..."
                                rows={3}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm
                           font-mono placeholder:text-text-tertiary/60 focus:outline-none
                           focus:ring-2 focus:ring-primary-200 resize-none"
                            />
                            <div className="flex items-center gap-3">
                                <label className="text-[12px] text-text-secondary">Duration:</label>
                                <input
                                    type="range"
                                    min={10}
                                    max={120}
                                    step={5}
                                    value={extendForm.duration}
                                    onChange={(e) => onExtendFormChange({duration: Number(e.target.value)})}
                                    className="flex-1 accent-primary-600"
                                />
                                <span className="text-[12px] text-text-primary tabular-nums w-10 text-right">
                  {extendForm.duration}s
                </span>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={onCloseExtend}
                                    className="px-3 py-1.5 rounded-lg text-[12px] text-text-secondary hover:bg-white
                             border border-border transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onExtend}
                                    disabled={loading}
                                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium
                             text-white bg-primary-600 hover:bg-primary-700 transition-colors cursor-pointer
                             disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="w-3 h-3 animate-spin"/> :
                                        <Repeat className="w-3 h-3"/>}
                                    Extend
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Remix inline form */}
            <AnimatePresence>
                {showRemixForm && (
                    <motion.div
                        initial={{opacity: 0, height: 0}}
                        animate={{opacity: 1, height: "auto"}}
                        exit={{opacity: 0, height: 0}}
                        className="overflow-hidden"
                    >
                        <div className="bg-surface-secondary rounded-xl border border-border-light p-4 space-y-3">
                            <h4 className="text-[13px] font-semibold text-text-primary flex items-center gap-1.5">
                                <Shuffle className="w-3.5 h-3.5 text-accent-500"/>
                                Remix Song
                            </h4>
                            <input
                                type="text"
                                value={remixForm.prompt}
                                onChange={(e) => onRemixFormChange({prompt: e.target.value})}
                                placeholder="Optional: describe remix direction..."
                                className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm
                           placeholder:text-text-tertiary/60 focus:outline-none focus:ring-2
                           focus:ring-primary-200"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] text-text-tertiary mb-1 block">Genre</label>
                                    <input
                                        type="text"
                                        value={remixForm.genre}
                                        onChange={(e) => onRemixFormChange({genre: e.target.value})}
                                        placeholder="e.g. Electronic"
                                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-white text-[12px]
                               focus:outline-none focus:ring-2 focus:ring-primary-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-text-tertiary mb-1 block">Mood</label>
                                    <input
                                        type="text"
                                        value={remixForm.mood}
                                        onChange={(e) => onRemixFormChange({mood: e.target.value})}
                                        placeholder="e.g. Energetic"
                                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-white text-[12px]
                               focus:outline-none focus:ring-2 focus:ring-primary-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-text-tertiary mb-1 block">Tempo (BPM)</label>
                                    <input
                                        type="number"
                                        value={remixForm.tempo ?? ""}
                                        onChange={(e) => onRemixFormChange({tempo: e.target.value ? Number(e.target.value) : undefined})}
                                        placeholder="120"
                                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-white text-[12px]
                               focus:outline-none focus:ring-2 focus:ring-primary-200"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] text-text-tertiary mb-1 block">Key</label>
                                    <input
                                        type="text"
                                        value={remixForm.musicalKey}
                                        onChange={(e) => onRemixFormChange({musicalKey: e.target.value})}
                                        placeholder="e.g. C Minor"
                                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-white text-[12px]
                               focus:outline-none focus:ring-2 focus:ring-primary-200"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={onCloseRemix}
                                    className="px-3 py-1.5 rounded-lg text-[12px] text-text-secondary hover:bg-white
                             border border-border transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={onRemix}
                                    disabled={loading}
                                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-medium
                             text-white bg-gradient-to-r from-primary-600 to-accent-500
                             hover:from-primary-700 hover:to-accent-600 transition-all cursor-pointer
                             disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {loading ? <Loader2 className="w-3 h-3 animate-spin"/> :
                                        <Shuffle className="w-3 h-3"/>}
                                    Remix
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

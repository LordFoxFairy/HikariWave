import {AnimatePresence, motion} from "framer-motion";
import {useTranslation} from "react-i18next";

interface ConfirmDialogProps {
    open: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
    message?: string;
}

export default function ConfirmDialog({
                                          open,
                                          onConfirm,
                                          onCancel,
                                          title,
                                          message,
                                      }: ConfirmDialogProps) {
    const {t} = useTranslation();
    const displayTitle = title || t("confirm.deleteItem");
    const displayMessage = message || t("confirm.cannotBeUndone");
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    exit={{opacity: 0}}
                    transition={{duration: 0.15}}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px]"
                    onClick={onCancel}
                >
                    <motion.div
                        initial={{opacity: 0, scale: 0.95, y: 8}}
                        animate={{opacity: 1, scale: 1, y: 0}}
                        exit={{opacity: 0, scale: 0.95, y: 8}}
                        transition={{duration: 0.15}}
                        className="bg-white rounded-2xl shadow-xl border border-border p-6 w-[340px] max-w-[90vw]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-[15px] font-semibold text-text-primary mb-1.5">
                            {displayTitle}
                        </h3>
                        <p className="text-[13px] text-text-tertiary leading-relaxed mb-5">
                            {displayMessage}
                        </p>
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 rounded-xl text-sm font-medium
                           text-text-secondary bg-surface-secondary
                           hover:bg-surface-tertiary transition-colors
                           cursor-pointer"
                            >
                                {t("confirm.cancel")}
                            </button>
                            <button
                                onClick={onConfirm}
                                className="px-4 py-2 rounded-xl text-sm font-medium
                           text-white bg-red-500 hover:bg-red-600
                           transition-colors cursor-pointer shadow-sm"
                            >
                                {t("confirm.delete")}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

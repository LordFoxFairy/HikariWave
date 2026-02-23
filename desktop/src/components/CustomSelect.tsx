import {useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {AnimatePresence, motion} from "framer-motion";
import {Check, ChevronDown} from "lucide-react";

export function CustomSelect({
                                 value,
                                 onChange,
                                 options,
                                 placeholder = "Select...",
                                 className = "",
                                 compact = false,
                                 labelFn,
                             }: {
    value: string;
    onChange: (value: string) => void;
    options: string[];
    placeholder?: string;
    className?: string;
    compact?: boolean;
    labelFn?: (opt: string) => string;
}) {
    const [open, setOpen] = useState(false);
    const [pos, setPos] = useState({top: 0, left: 0, width: 0, openUp: false});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const openUp = rect.bottom > window.innerHeight * 0.65;
        setPos({
            top: openUp ? rect.top - 6 : rect.bottom + 6,
            left: rect.left,
            width: rect.width,
            openUp,
        });
    }, []);

    useEffect(() => {
        if (!open) return;
        updatePosition();
        const onScroll = () => setOpen(false);
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", onScroll);
        return () => {
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", onScroll);
        };
    }, [open, updatePosition]);

    // Click outside
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                triggerRef.current &&
                !triggerRef.current.contains(target) &&
                dropdownRef.current &&
                !dropdownRef.current.contains(target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const dropdown = open
        ? createPortal(
            <AnimatePresence>
                <motion.div
                    ref={dropdownRef}
                    initial={{opacity: 0, y: pos.openUp ? 4 : -4}}
                    animate={{opacity: 1, y: 0}}
                    exit={{opacity: 0, y: pos.openUp ? 4 : -4}}
                    transition={{duration: 0.15}}
                    style={{
                        position: "fixed",
                        top: pos.openUp ? undefined : pos.top,
                        bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
                        left: pos.left,
                        width: compact ? "auto" : pos.width,
                        minWidth: compact ? 160 : undefined,
                        zIndex: 9999,
                    }}
                    className="bg-white rounded-xl border border-border shadow-xl shadow-black/8
                       max-h-52 overflow-y-auto py-1 overscroll-contain
                       [&::-webkit-scrollbar]:w-1.5
                       [&::-webkit-scrollbar-track]:bg-transparent
                       [&::-webkit-scrollbar-thumb]:bg-gray-200
                       [&::-webkit-scrollbar-thumb]:rounded-full
                       hover:[&::-webkit-scrollbar-thumb]:bg-gray-300"
                >
                    {options.map((opt) => (
                        <button
                            key={opt}
                            type="button"
                            onClick={() => {
                                onChange(opt);
                                setOpen(false);
                            }}
                            className={`w-full flex items-center text-left px-3 py-1.5 text-sm cursor-pointer transition-colors
                  ${
                                opt === value
                                    ? "bg-primary-50 text-primary-700 font-medium"
                                    : "text-text-primary hover:bg-gray-50"
                            }`}
                        >
                            <span className="flex-1">{labelFn?.(opt) ?? opt}</span>
                            {opt === value && (
                                <Check className="w-3.5 h-3.5 text-primary-500 ml-2 flex-shrink-0"/>
                            )}
                        </button>
                    ))}
                </motion.div>
            </AnimatePresence>,
            document.body,
        )
        : null;

    return (
        <div className={className}>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={`flex items-center justify-between gap-2 cursor-pointer transition-all
          ${
                    compact
                        ? "px-2.5 py-1.5 rounded-lg border text-xs"
                        : "w-full px-4 py-2.5 rounded-xl border text-sm"
                }
          ${
                    open
                        ? "border-primary-300 ring-2 ring-primary-200 bg-white"
                        : "border-border bg-white hover:border-primary-200"
                }
          text-text-primary`}
            >
        <span className={value ? "" : "text-text-tertiary"}>
          {value ? (labelFn?.(value) ?? value) : placeholder}
        </span>
                <ChevronDown
                    className={`w-3.5 h-3.5 text-text-tertiary transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>
            {dropdown}
        </div>
    );
}

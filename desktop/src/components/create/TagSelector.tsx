import {useCallback, useEffect, useRef, useState} from "react";
import {Plus, X} from "lucide-react";

interface TagSelectorProps {
    presets: string[];
    selected: string[];
    onToggle: (value: string) => void;
    colorFn?: (tag: string, isSelected: boolean) => string;
    labelFn?: (tag: string) => string;
    placeholder?: string;
}

export function TagSelector({
                                presets,
                                selected,
                                onToggle,
                                colorFn,
                                labelFn,
                                placeholder = "Add tag...",
                            }: TagSelectorProps) {
    const [showInput, setShowInput] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Custom tags = selected items that are not in presets
    const customTags = selected.filter(
        (tag) => !presets.some((p) => p.toLowerCase() === tag.toLowerCase()),
    );

    useEffect(() => {
        if (showInput && inputRef.current) {
            inputRef.current.focus();
        }
    }, [showInput]);

    // Close input on click outside
    useEffect(() => {
        if (!showInput) return;

        function handleClick(e: MouseEvent) {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setShowInput(false);
                setInputValue("");
            }
        }

        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [showInput]);

    const addCustomTag = useCallback(() => {
        const trimmed = inputValue.trim();
        if (!trimmed) return;
        // Duplicate check (case-insensitive) across all selected
        const isDuplicate = selected.some(
            (s) => s.toLowerCase() === trimmed.toLowerCase(),
        );
        if (isDuplicate) {
            setInputValue("");
            return;
        }
        onToggle(trimmed);
        setInputValue("");
    }, [inputValue, selected, onToggle]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addCustomTag();
        } else if (e.key === "Escape") {
            setShowInput(false);
            setInputValue("");
        }
    };

    return (
        <div className="flex flex-wrap gap-1.5" ref={containerRef}>
            {/* Preset tags */}
            {presets.map((tag) => {
                const sel = selected.includes(tag);
                const customColors = colorFn ? colorFn(tag, sel) : "";
                return (
                    <button
                        key={tag}
                        onClick={() => onToggle(tag)}
                        className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all cursor-pointer border
              ${
                            sel
                                ? customColors ||
                                "bg-primary-50 text-primary-700 border-primary-200 shadow-sm"
                                : "bg-white text-text-secondary border-border hover:border-primary-200 hover:text-text-primary"
                        }`}
                    >
                        {labelFn?.(tag) ?? tag}
                    </button>
                );
            })}

            {/* Custom tags */}
            {customTags.map((tag) => (
                <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12px] font-medium border border-dashed border-primary-300 bg-primary-50/50 text-primary-700 shadow-sm"
                >
          {labelFn?.(tag) ?? tag}
                    <button
                        onClick={() => onToggle(tag)}
                        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-primary-200/60 transition-colors cursor-pointer"
                    >
            <X className="w-2.5 h-2.5"/>
          </button>
        </span>
            ))}

            {/* Add button / inline input */}
            {showInput ? (
                <div className="inline-flex items-center gap-1">
                    <input
                        ref={inputRef}
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="h-8 px-3 rounded-full text-[12px] font-medium border border-primary-300 bg-white text-text-primary outline-none focus:ring-1 focus:ring-primary-300 w-28"
                    />
                    <button
                        onClick={addCustomTag}
                        className="w-8 h-8 rounded-full bg-primary-50 border border-primary-300 text-primary-600 hover:bg-primary-100 flex items-center justify-center transition-colors cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5"/>
                    </button>
                </div>
            ) : (
                <button
                    onClick={() => setShowInput(true)}
                    className="w-8 h-8 rounded-full border border-dashed border-border text-text-tertiary hover:border-primary-300 hover:text-primary-500 flex items-center justify-center transition-colors cursor-pointer"
                >
                    <Plus className="w-3.5 h-3.5"/>
                </button>
            )}
        </div>
    );
}

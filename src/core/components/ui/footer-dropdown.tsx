"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FooterDropdownProps {
    options: readonly string[] | string[];
    value: string;
    onChange: (value: string) => void;
    formatLabel?: (value: string) => string;
}

/**
 * Compact footer-styled dropdown.
 * Used by core's language selector and modules' footer selectors (currency, etc.)
 * to keep visual consistency across all footer dropdowns.
 */
export function FooterDropdown({ options, value, onChange, formatLabel }: FooterDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm min-w-[100px]"
            >
                <span className="flex-1 text-left">{formatLabel ? formatLabel(value) : value}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute bottom-full left-0 mb-1 w-full bg-card border border-white/10 rounded shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                        {options.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => {
                                    onChange(option);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-white/10 transition-colors ${
                                    value === option ? "bg-blue-600 text-white" : "text-muted-foreground"
                                }`}
                            >
                                {formatLabel ? formatLabel(option) : option}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

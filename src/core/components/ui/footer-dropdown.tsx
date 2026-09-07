"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useModalDialog } from "@/core/hooks/useModalDialog";

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

    // The only way to close this was clicking the invisible sheet over the
    // page, which a keyboard user cannot do. Escape and focus restoration come
    // from the shared hook rather than a second copy of them here; the trap is
    // off because the page behind a footer dropdown stays usable.
    const panelRef = useModalDialog<HTMLDivElement>(isOpen, () => setIsOpen(false), {
        trapFocus: false,
        autoFocus: false,
    });

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm min-w-[100px]"
            >
                <span className="flex-1 text-left">{formatLabel ? formatLabel(value) : value}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />
                    <div ref={panelRef} className="absolute bottom-full left-0 mb-1 w-full bg-card border border-border rounded shadow-xl z-50 overflow-hidden max-h-48 overflow-y-auto">
                        {options.map((option) => (
                            <button
                                key={option}
                                type="button"
                                onClick={() => {
                                    onChange(option);
                                    setIsOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                                    value === option ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
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

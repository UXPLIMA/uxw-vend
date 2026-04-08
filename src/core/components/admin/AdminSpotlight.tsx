"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, FileText, User, Settings as SettingsIcon, Package, Layers } from "lucide-react";

interface SearchResult {
    type: string;
    id: string;
    title: string;
    subtitle?: string;
    href: string;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    page: FileText,
    settings: SettingsIcon,
    "module-page": Package,
    user: User,
    module: Layers,
};

/**
 * Cmd+K / Ctrl+K spotlight search.
 * Mounted in the admin layout — listens globally for the keyboard shortcut.
 */
export function AdminSpotlight() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Keyboard shortcut: Cmd+K / Ctrl+K
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((v) => !v);
            } else if (e.key === "Escape" && open) {
                setOpen(false);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [open]);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
        } else {
            setQuery("");
            setResults([]);
            setSelectedIdx(0);
        }
    }, [open]);

    // Debounced search
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/v1/admin/search?q=${encodeURIComponent(query)}`);
                if (res.ok) {
                    const data = await res.json();
                    setResults(data.results || []);
                    setSelectedIdx(0);
                }
            } finally {
                setLoading(false);
            }
        }, 200);
        return () => clearTimeout(timer);
    }, [query]);

    // Arrow navigation
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelectedIdx((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            const selected = results[selectedIdx];
            if (selected) {
                router.push(selected.href);
                setOpen(false);
            }
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-32 px-4 bg-black/50" onClick={() => setOpen(false)}>
            <div
                className="bg-card rounded-lg shadow-2xl border border-border w-full max-w-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                        placeholder="Search admin pages, users, settings…"
                        className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
                    />
                    <kbd className="hidden sm:inline px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted rounded">ESC</kbd>
                    <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="max-h-96 overflow-y-auto">
                    {loading && results.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Searching…</div>
                    ) : query.length < 2 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Start typing to search</div>
                    ) : results.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">No results</div>
                    ) : (
                        <div className="py-1">
                            {results.map((r, i) => {
                                const Icon = TYPE_ICONS[r.type] || FileText;
                                return (
                                    <button
                                        key={`${r.href}-${i}`}
                                        type="button"
                                        onClick={() => { router.push(r.href); setOpen(false); }}
                                        onMouseEnter={() => setSelectedIdx(i)}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                                            i === selectedIdx ? "bg-muted" : ""
                                        }`}
                                    >
                                        <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm text-foreground truncate">{r.title}</div>
                                            {r.subtitle && (
                                                <div className="text-xs text-muted-foreground truncate">{r.subtitle}</div>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{r.type}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="border-t border-border px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
                        <span>Navigate</span>
                        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
                        <span>Open</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">⌘K</kbd>
                        <span>to toggle</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

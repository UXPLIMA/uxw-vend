"use client";

import { useState, useEffect, useRef } from "react";
import { Link } from "@/core/lib/i18n/navigation";
import { Search, User, Package, X } from "lucide-react";

interface SearchResult {
    type: string;
    id: string;
    title: string;
    subtitle: string;
    href: string;
}

const typeIcons: Record<string, typeof User> = {
    user: User,
};

export function AdminSearch() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResult[]>([]);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- debounced search, safe pattern
        if (query.length < 2) { setResults([]); return; }
        const timer = setTimeout(() => {
            fetch(`/api/v1/admin/search?q=${encodeURIComponent(query)}`)
                .then((r) => r.json())
                .then((d) => { setResults(d.results || []); setOpen(true); })
                .catch(() => {});
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    placeholder="Search..."
                    className="w-full pl-9 pr-8 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
                {query && (
                    <button onClick={() => { setQuery(""); setResults([]); setOpen(false); }} className="absolute right-2 top-1/2 -translate-y-1/2">
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                )}
            </div>

            {open && results.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    {results.map((r) => {
                        const Icon = typeIcons[r.type] || Package;
                        return (
                            <Link
                                key={`${r.type}-${r.id}`}
                                href={r.href}
                                onClick={() => { setOpen(false); setQuery(""); }}
                                className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors"
                            >
                                <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{r.type} · {r.subtitle}</p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

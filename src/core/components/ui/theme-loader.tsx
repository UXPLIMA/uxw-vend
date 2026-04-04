"use client";

import { Loader2 } from "lucide-react";

export function ThemeLoader() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center transition-opacity duration-300"
            style={{ backgroundColor: "var(--color-background, #f3f4f6)" }}>
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--color-primary, #2563eb)" }} />
            </div>
        </div>
    );
}

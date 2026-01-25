"use client";

import { Loader2 } from "lucide-react";

export function ThemeLoader() {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white transition-opacity duration-300">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            </div>
        </div>
    );
}

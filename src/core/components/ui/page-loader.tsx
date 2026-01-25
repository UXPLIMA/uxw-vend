"use client";

import { Loader2 } from "lucide-react";

export function PageLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
            </div>
        </div>
    );
}

'use client';

import { useEffect } from 'react';
import { useTranslations } from "next-intl";
import { Button } from "@/core/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

function useErrorTranslations() {
    try {
        const t = useTranslations("common");
        return {
            title: t("error_title") || "Something went wrong",
            description: t("error_description") || "An unexpected error occurred. Please try again.",
            retry: t("retry") || "Try Again",
            goHome: t("go_home") || "Go Home",
        };
    } catch {
        return {
            title: "Something went wrong",
            description: "An unexpected error occurred. Please try again.",
            retry: "Try Again",
            goHome: "Go Home",
        };
    }
}

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const labels = useErrorTranslations();

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 bg-muted">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-center max-w-md">
                <h2 className="text-2xl font-bold text-foreground mb-2">{labels.title}</h2>
                <p className="text-muted-foreground text-sm mb-6">
                    {labels.description}
                </p>
            </div>
            <div className="flex gap-3">
                <Button onClick={() => reset()}>
                    <RotateCcw className="w-4 h-4 mr-2" /> {labels.retry}
                </Button>
                <Button variant="outline" onClick={() => window.location.href = "/"}>
                    <Home className="w-4 h-4 mr-2" /> {labels.goHome}
                </Button>
            </div>
            {process.env.NODE_ENV === "development" && (
                <pre className="mt-4 p-4 bg-gray-900 text-red-400 rounded-lg text-xs max-w-2xl overflow-auto font-mono">
                    {error.message}
                </pre>
            )}
        </div>
    );
}

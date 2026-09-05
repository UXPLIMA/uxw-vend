'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/core/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * next-intl does not throw on a missing message: it logs and returns the key
 * path, which is a non-empty string. `t(key) || "fallback"` therefore never
 * reaches its fallback, and this screen would have rendered "common.error_title"
 * as its heading. `t.has()` is the supported guard, and it matters more here
 * than anywhere else - this is the page a visitor sees when the rest broke.
 *
 * The provider itself is guaranteed: an error boundary does not catch its own
 * segment's layout, so if this renders, the layout that provides the messages
 * already succeeded.
 */
function useErrorTranslations() {
    const t = useTranslations("common");
    const label = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);
    return {
        title: label("error_title", "Something went wrong"),
        description: label("error_description", "An unexpected error occurred. Please try again."),
        retry: label("retry", "Try Again"),
        goHome: label("go_home", "Go Home"),
    };
}

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const labels = useErrorTranslations();
    const locale = useLocale();

    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 bg-muted">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-center max-w-md">
                <h1 className="text-2xl font-bold text-foreground mb-2">{labels.title}</h1>
                <p className="text-muted-foreground text-sm mb-6">
                    {labels.description}
                </p>
            </div>
            <div className="flex gap-3">
                <Button onClick={() => reset()}>
                    <RotateCcw className="w-4 h-4 mr-2" /> {labels.retry}
                </Button>
                {/*
                  * A hard navigation, deliberately. This is the error boundary:
                  * the React tree below it has already thrown, and a soft
                  * navigation reuses that tree. Reloading is what makes
                  * "go home" reliably recover.
                  */}
                {/* eslint-disable-next-line @next/next/no-location-assign-relative-destination */}
                <Button variant="outline" onClick={() => window.location.href = `/${locale}`}>
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

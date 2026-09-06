"use client";

import React from "react";
import { unstable_rethrow } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { useTranslations } from "next-intl";

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * The fallback is its own function component so that it can be translated.
 *
 * A class component cannot call a hook, which is why this screen stayed in
 * English while the rest of the site followed the reader's locale. It does not
 * have to: the boundary sits inside `NextIntlClientProvider` in the locale
 * layout, so anything it renders can ask for the catalogue itself.
 */
function ErrorFallback({ onReload }: { onReload: () => void }) {
    const t = useTranslations("common");

    return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
            <div className="text-center max-w-md">
                <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-2">{t("error_title")}</h2>
                <p className="text-muted-foreground mb-6">{t("error_reported")}</p>
                <Button onClick={onReload}>
                    <RefreshCw className="w-4 h-4" />
                    {t("reloadPage")}
                </Button>
            </div>
        </div>
    );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        // `notFound()`, `redirect()` and friends signal by throwing. Catching
        // one here swallows the signal: the server had already committed a 200
        // by the time the not-found page appeared, so every unknown URL was a
        // soft 404 that search engines happily indexed.
        unstable_rethrow(error);
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        unstable_rethrow(error);
        // Report to server
        fetch("/api/v1/error-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: error.message,
                stack: error.stack,
                componentStack: errorInfo.componentStack,
                url: typeof window !== "undefined" ? window.location.href : "",
                userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
                timestamp: new Date().toISOString(),
            }),
        }).catch(() => { /* fire and forget */ });
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <ErrorFallback
                    onReload={() => {
                        this.setState({ hasError: false, error: null });
                        window.location.reload();
                    }}
                />
            );
        }

        return this.props.children;
    }
}

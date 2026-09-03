"use client";

import React from "react";
import { unstable_rethrow } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/core/components/ui/button";

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
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
                <div className="min-h-[400px] flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                        <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
                        <p className="text-muted-foreground mb-6">
                            An unexpected error occurred. The error has been reported automatically.
                        </p>
                        <Button
                            onClick={() => {
                                this.setState({ hasError: false, error: null });
                                window.location.reload();
                            }}
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Reload Page
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

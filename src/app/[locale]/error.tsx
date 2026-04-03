'use client';

import { useEffect } from 'react';
import { Button } from "@/core/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 bg-gray-50">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div className="text-center max-w-md">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h2>
                <p className="text-gray-500 text-sm mb-6">
                    An unexpected error occurred. Please try again.
                </p>
            </div>
            <div className="flex gap-3">
                <Button onClick={() => reset()}>
                    <RotateCcw className="w-4 h-4 mr-2" /> Try Again
                </Button>
                <Button variant="outline" onClick={() => window.location.href = "/"}>
                    <Home className="w-4 h-4 mr-2" /> Go Home
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

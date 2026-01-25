
'use client';

import { useEffect } from 'react';
import { Button } from "@/core/components/ui/button";

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
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
            <h2 className="text-2xl font-bold">Something went wrong!</h2>
            <p className="text-muted-foreground p-4 bg-gray-100 rounded border font-mono text-sm whitespace-pre-wrap max-w-4xl overflow-auto">
                {error.message}
                {error.stack && `\n\nstack:\n${error.stack}`}
            </p>
            <div className="flex gap-2">
                <Button onClick={() => reset()}>Try again</Button>
                <Button variant="outline" onClick={() => window.location.reload()}>Reload Page</Button>
            </div>
        </div>
    );
}

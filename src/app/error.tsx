"use client";

/**
 * Root error boundary.
 *
 * Reached for a failure that never enters a locale segment. It carries its own
 * document for the same reason the root not-found does: the site's root layout
 * is `app/[locale]/layout.tsx`, so nothing above this file supplies `<html>`,
 * and a boundary that renders a bare `<div>` there leaves the browser with no
 * document to put it in.
 *
 * Deliberately plain, and in English: no locale is resolved this far out, and
 * a boundary that reaches for the database to translate itself is a boundary
 * that can fail while reporting a failure.
 */
export default function RootError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en">
        <body className="antialiased bg-background">
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="text-center max-w-md">
                <h1 className="text-2xl font-bold text-foreground mb-2">
                    Something went wrong
                </h1>
                {/*
                  * The message stays out of the page. Next redacts a server
                  * error's message in production, but an error thrown in a
                  * client component keeps its real text, and that text is
                  * written for whoever reads the logs, not for a visitor.
                  */}
                <p className="text-muted-foreground mb-6">
                    An unexpected error occurred. Please try again.
                </p>
                {process.env.NODE_ENV === "development" && (
                    <pre className="mb-6 p-4 bg-gray-900 text-red-400 rounded-lg text-xs text-left overflow-auto font-mono">
                        {error.message}
                    </pre>
                )}
                <button
                    onClick={() => reset()}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:opacity-90 transition-opacity"
                >
                    Retry
                </button>
            </div>
        </div>
        </body>
        </html>
    );
}

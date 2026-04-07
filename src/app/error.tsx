"use client";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
            <div className="text-center max-w-md">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                    Something went wrong
                </h2>
                <p className="text-muted-foreground mb-6">
                    {error.message || "An unexpected error occurred. Please try again."}
                </p>
                <button
                    onClick={() => reset()}
                    className="px-4 py-2 bg-primary text-white rounded-md hover:opacity-90 transition-opacity"
                >
                    Retry
                </button>
            </div>
        </div>
    );
}

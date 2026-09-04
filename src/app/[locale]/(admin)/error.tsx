"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations("admin");

    useEffect(() => {
        console.error("Admin error:", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-800 dark:bg-zinc-900">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                    <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("error_title")}
                </h2>
                <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
                    {t("error_body")}
                    {error.digest && (
                        <span className="mt-1 block font-mono text-xs text-zinc-400 dark:text-zinc-500">
                            {t("error_id")} {error.digest}
                        </span>
                    )}
                </p>
                <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                    <RotateCcw className="h-4 w-4" />
                    {t("error_tryAgain")}
                </button>
            </div>
        </div>
    );
}

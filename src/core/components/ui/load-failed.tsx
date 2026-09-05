"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/core/components/ui/button";

/**
 * What a screen shows when the request behind it did not come back.
 *
 * A list screen has two ways to be empty and had one way to say so. Forty
 * screens fetched their content, swallowed every failure, and rendered the
 * same "nothing here yet" that a genuinely empty table renders: a server
 * error, an expired session and an offline connection all read as "you have
 * no orders". Worse, the message invites exactly the wrong response, since
 * the reader believes the data is gone rather than unreachable.
 *
 * `onRetry` is not decoration. The screens this replaces load once on mount,
 * so without it the only way back is a page reload.
 */
export function LoadFailed({ onRetry, className = "" }: { onRetry?: () => void; className?: string }) {
    const t = useTranslations("common");
    return (
        <div role="alert" className={`flex flex-col items-center gap-3 py-12 text-center ${className}`}>
            <AlertTriangle className="w-6 h-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
            {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                    {t("retry")}
                </Button>
            )}
        </div>
    );
}

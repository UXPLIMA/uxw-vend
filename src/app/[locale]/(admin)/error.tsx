"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/core/components/ui/button";
import { Card, CardContent } from "@/core/components/ui/card";

/**
 * The screen an operator sees when an admin page throws.
 *
 * Two things were wrong with it, and they compounded.
 *
 * It read its own wording from the `admin` namespace. An error boundary
 * renders where the segment that threw was, and this one sits above
 * `admin/layout.tsx` - which is the only place the `admin` namespace is
 * handed to the browser, because no public page renders it and the locale
 * layout strips it. So the boundary that catches a crash in the admin panel
 * cannot read admin strings, and the screen rendered `admin.error_title` as
 * its heading. Its wording comes from `common` now, which every page has.
 *
 * And it was painted in `bg-white`, `border-red-200`, `text-zinc-900` with
 * `dark:` variants - which do nothing here, because this project switches
 * themes on `[data-mode="dark"]` rather than Tailwind's media-query variant.
 * On a dark panel it was a white card with black text. It uses the theme's
 * own tokens now, like every other surface.
 */

export default function AdminError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const t = useTranslations("common");

    useEffect(() => {
        console.error("Admin error:", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] items-center justify-center p-6">
            <Card className="w-full max-w-md">
                <CardContent className="p-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                    </div>
                    <h1 className="mb-2 text-lg font-semibold text-foreground">
                        {t("error_title")}
                    </h1>
                    <p className="mb-6 text-sm text-muted-foreground">
                        {t("error_description")}
                    </p>
                    {error.digest && (
                        <p className="mb-6 -mt-4 font-mono text-xs text-muted-foreground">
                            {t("error_id")} {error.digest}
                        </p>
                    )}
                    <Button onClick={reset}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {t("retry")}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}

"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/core/lib/i18n/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { SetupResult } from "../types";

export function DoneStep({ completed, result }: { completed: boolean; result: SetupResult | null }) {
    const t = useTranslations("setup.done");
    const installed = result?.installedModules ?? [];
    const autoAdded = result?.autoAdded ?? [];
    const failed = result?.failedModules ?? [];
    return (
        <div className="text-center space-y-4 py-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 text-green-600">
                <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-foreground">
                {completed ? t("title") : t("working")}
            </h2>
            <p className="text-sm text-muted-foreground">{completed ? t("body") : t("waiting")}</p>

            {completed && installed.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                    <div>{t("installed", { modules: installed.join(", ") })}</div>
                    {autoAdded.length > 0 && (
                        <div className="text-blue-700">
                            {t("autoAdded", { modules: autoAdded.join(", ") })}
                        </div>
                    )}
                </div>
            )}
            {completed && failed.length > 0 && (
                <div className="text-xs text-red-700">
                    {t("failed", { modules: failed.map((f) => f.id).join(", ") })}
                </div>
            )}

            {completed && (
                <div className="pt-2">
                    <Link
                        href="/admin"
                        className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium"
                    >
                        {t("goAdmin")} <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            )}
        </div>
    );
}

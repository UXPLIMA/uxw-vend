"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";

interface Suggestion { id: string; reason?: string }

export function SuggestedModulesBanner({ themeName, suggestions }: { themeName: string; suggestions: Suggestion[] }) {
    const t = useTranslations("admin");
    if (!suggestions?.length) return null;
    return (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 mb-4 text-sm">
            <div className="flex items-center gap-2 font-medium text-amber-900">
                <AlertTriangle className="w-4 h-4" />
                {t("theme_suggests", { name: themeName })}
            </div>
            <ul className="mt-2 space-y-1 text-amber-900">
                {suggestions.map(s => (
                    <li key={s.id}>
                        <Link href={`/admin/modules?install=${s.id}`} className="underline">{s.id}</Link>
                        {s.reason ? ` — ${s.reason}` : null}
                    </li>
                ))}
            </ul>
        </div>
    );
}

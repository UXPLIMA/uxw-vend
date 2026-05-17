"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card";
import { Award, Loader2 } from "lucide-react";
import { Link } from "@/core/lib/i18n/navigation";

interface EarnedTrophy {
    id: string;
    awardedAt: string;
    trophy: {
        id: string;
        name: string;
        description: string | null;
        icon: string | null;
        color: string | null;
        points: number;
    };
}

export default function TrophiesTab() {
    const t = useTranslations("trophies");
    const __locale = useLocale();
    const __dateTag = __locale === "tr" ? "tr-TR" : __locale;
    const [earned, setEarned] = useState<EarnedTrophy[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/me/trophies")
            .then(r => r.ok ? r.json() : { earned: [], total: 0 })
            .then(d => {
                setEarned(Array.isArray(d.earned) ? d.earned : []);
                setTotal(Number(d.total) || 0);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-500" />
                    {t("title")}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                        {t("earnedCount", { earned: earned.length, total })}
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center py-6">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                ) : earned.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                        {t("noneYet")}{" "}
                        <Link href="/trophies" className="text-primary hover:underline">
                            {t("browseAll")}
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {earned.map((et) => (
                            <div
                                key={et.id}
                                className="flex items-center gap-2 p-2 rounded-md border border-border"
                                title={et.trophy.description || et.trophy.name}
                            >
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0"
                                    style={{ backgroundColor: et.trophy.color || "#6366f1" }}
                                >
                                    <Award className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-medium text-xs truncate">{et.trophy.name}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                        {new Date(et.awardedAt).toLocaleDateString(__dateTag)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

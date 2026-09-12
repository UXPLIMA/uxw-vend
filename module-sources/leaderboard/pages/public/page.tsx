"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button, Card, CardContent, LoadFailed, NavIcon, Waiting, useSiteCurrency } from "@/core/sdk/ui";
import { PageFrame } from "@/core/sdk/layout";

interface Row {
    username: string;
    avatar: string | null;
    value: number;
}

interface Board {
    id: string;
    labelKey: string;
    icon: string;
    unit: "currency" | "count";
    rows: Row[];
}

/** Gold, silver, bronze, then nothing. */
const rankColours = ["text-warning", "text-muted-foreground", "text-warning"];

/**
 * The page shows the boards the install offers, whatever they are.
 *
 * It used to name three of them - buyers, voters, forum - and ask the
 * endpoint which of the three were available. The modules that own that data
 * now offer their own board, so a fourth arrives with its module and this file
 * does not change. The label comes with the board, as a full message key,
 * because it belongs to whoever offered it.
 */
export default function LeaderboardPage() {
    const t = useTranslations("leaderboard");
    const everything = useTranslations();
    const { format: formatPrice } = useSiteCurrency();

    const [boards, setBoards] = useState<Board[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [reloadKey, setReloadKey] = useState(0);

    // Which tabs there are. Asked once, and with no board named, so a module
    // answers with its heading rather than with a query.
    useEffect(() => {
        let cancelled = false;
        fetch("/api/v1/leaderboard")
            .then((r) => { if (!r.ok) throw new Error("load failed"); return r.json(); })
            .then((d: { boards?: Board[] }) => {
                if (cancelled) return;
                const offered = d.boards ?? [];
                setBoards(offered);
                setActiveId((current) => current ?? offered[0]?.id ?? null);
                if (offered.length === 0) setLoading(false);
            })
            .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
        return () => { cancelled = true; };
    }, [reloadKey]);

    // And the rows of the one being looked at.
    useEffect(() => {
        if (!activeId) return;
        let cancelled = false;
        setLoading(true);
        fetch(`/api/v1/leaderboard?board=${encodeURIComponent(activeId)}&limit=20`)
            .then((r) => { if (!r.ok) throw new Error("load failed"); return r.json(); })
            .then((d: { boards?: Board[] }) => {
                if (cancelled) return;
                setRows((d.boards ?? []).find((b) => b.id === activeId)?.rows ?? []);
                setFailed(false);
                setLoading(false);
            })
            .catch(() => { if (!cancelled) { setFailed(true); setLoading(false); } });
        return () => { cancelled = true; };
    }, [activeId, reloadKey]);

    const active = boards.find((b) => b.id === activeId) ?? null;

    return (
        <PageFrame title={t("title")} description={t("subtitle")}>
            {boards.length > 1 && (
                <div className="flex flex-wrap gap-2 mb-6">
                    {boards.map((board) => (
                        <Button
                            key={board.id}
                            variant={board.id === activeId ? "default" : "outline"}
                            onClick={() => setActiveId(board.id)}
                        >
                            <NavIcon name={board.icon} className="w-4 h-4" />
                            {everything(board.labelKey)}
                        </Button>
                    ))}
                </div>
            )}

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <Waiting label={t("title")} />
                    ) : failed ? (
                        <LoadFailed onRetry={() => setReloadKey((k) => k + 1)} />
                    ) : rows.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">{t("noData")}</p>
                    ) : (
                        <div className="divide-y">
                            {rows.map((row, i) => (
                                <div key={`${row.username}-${i}`} className="flex items-center gap-4 p-4">
                                    <div className={`w-8 text-center font-bold text-lg ${rankColours[i] || "text-muted-foreground"}`}>
                                        #{i + 1}
                                    </div>
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-bold text-sm overflow-hidden">
                                        {row.avatar ? (
                                            <Image
                                                src={row.avatar}
                                                alt={row.username}
                                                width={40}
                                                height={40}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            row.username.charAt(0).toUpperCase()
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-medium">{row.username}</p>
                                    </div>
                                    <div className="text-right font-bold">
                                        {active?.unit === "currency" ? formatPrice(row.value) : row.value}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </PageFrame>
    );
}

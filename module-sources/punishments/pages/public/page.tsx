"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Loader2, Search, Ban, VolumeX, LogOut, AlertTriangle } from "lucide-react";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

interface PunishmentItem {
    id: string;
    playerName: string;
    type: string;
    reason: string | null;
    duration: string | null;
    active: boolean;
    punishedBy: string | null;
    createdAt: string;
    expiresAt: string | null;
}

const typeIcons: Record<string, typeof Ban> = { ban: Ban, mute: VolumeX, kick: LogOut, warn: AlertTriangle };
const typeColors: Record<string, string> = {
    ban: "bg-red-100 text-red-700",
    mute: "bg-orange-100 text-orange-700",
    kick: "bg-yellow-100 text-yellow-700",
    warn: "bg-blue-100 text-blue-700",
};

const typeKeys: Record<string, string> = { ban: "ban", mute: "mute", kick: "kick", warn: "warning" };

export default function PunishmentsPage() {
    const t = useTranslations("punishments");
    const [punishments, setPunishments] = useState<PunishmentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchData = () => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (search) params.set("search", search);
        if (typeFilter) params.set("type", typeFilter);

        fetch(`/api/v1/punishments?${params}`)
            .then((r) => r.json())
            .then((d) => { setPunishments(d.punishments || []); setTotalPages(d.pages || 1); setLoading(false); })
            .catch(() => setLoading(false));
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    useEffect(() => { fetchData(); }, [page, typeFilter]);

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchData(); };

    return (
        <div className="min-h-screen flex flex-col bg-muted">
            <ThemeComponentSlot name="Hero" />
            <Navbar />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-4xl">
                <h1 className="text-3xl font-bold text-foreground mb-2">{t("title")}</h1>
                <p className="text-muted-foreground mb-6">{t("description")}</p>

                {/* Search & Filter */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-10" />
                        </div>
                    </form>
                    <div className="flex gap-2">
                        {["", "ban", "mute", "kick", "warn"].map((tf) => (
                            <Button key={tf} variant={typeFilter === tf ? "default" : "outline"} size="sm"
                                onClick={() => { setTypeFilter(tf); setPage(1); }}>
                                {tf === "" ? t("type") : t(typeKeys[tf] || tf)}
                            </Button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : punishments.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">{t("noPunishments")}</CardContent></Card>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full bg-card rounded-xl border">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t("player")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t("type")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t("reason")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t("punishedBy")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t("duration")}</th>
                                        <th className="text-left py-3 px-4 font-medium text-muted-foreground text-sm">{t("date")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {punishments.map((p) => {
                                        const Icon = typeIcons[p.type] || Ban;
                                        return (
                                            <tr key={p.id} className="border-b last:border-0 hover:bg-muted">
                                                <td className="py-3 px-4 font-medium">{p.playerName}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${typeColors[p.type] || ""}`}>
                                                        <Icon className="w-3 h-3" /> {p.type}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground max-w-[200px] truncate">{p.reason || "-"}</td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground">{p.punishedBy || "Console"}</td>
                                                <td className="py-3 px-4 text-sm">{p.duration || t("permanent")}</td>
                                                <td className="py-3 px-4 text-sm text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-4">
                                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>&laquo;</Button>
                                <span className="flex items-center px-3 text-sm text-muted-foreground">{page}/{totalPages}</span>
                                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>&raquo;</Button>
                            </div>
                        )}
                    </>
                )}
            </main>

            <Footer />
        </div>
    );
}

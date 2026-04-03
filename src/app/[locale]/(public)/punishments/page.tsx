"use client";

import { useState, useEffect } from "react";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Input } from "@/core/components/ui/input";
import { Loader2, Search, Ban, VolumeX, LogOut, AlertTriangle } from "lucide-react";

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

export default function PunishmentsPage() {
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

    useEffect(() => { fetchData(); }, [page, typeFilter]);

    const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchData(); };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-4xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Punishments</h1>
                <p className="text-gray-500 mb-6">Server bans, mutes, kicks, and warnings</p>

                {/* Search & Filter */}
                <div className="flex flex-wrap gap-3 mb-6">
                    <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-[200px]">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search player..." className="pl-10" />
                        </div>
                    </form>
                    <div className="flex gap-2">
                        {["", "ban", "mute", "kick", "warn"].map((t) => (
                            <Button key={t} variant={typeFilter === t ? "default" : "outline"} size="sm"
                                onClick={() => { setTypeFilter(t); setPage(1); }}>
                                {t === "" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}
                            </Button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                ) : punishments.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-gray-500">No punishments found</CardContent></Card>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full bg-white rounded-xl border">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Player</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Type</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Reason</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">By</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Duration</th>
                                        <th className="text-left py-3 px-4 font-medium text-gray-500 text-sm">Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {punishments.map((p) => {
                                        const Icon = typeIcons[p.type] || Ban;
                                        return (
                                            <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                                                <td className="py-3 px-4 font-medium">{p.playerName}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 ${typeColors[p.type] || ""}`}>
                                                        <Icon className="w-3 h-3" /> {p.type}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-600 max-w-[200px] truncate">{p.reason || "-"}</td>
                                                <td className="py-3 px-4 text-sm text-gray-500">{p.punishedBy || "Console"}</td>
                                                <td className="py-3 px-4 text-sm">{p.duration || "Permanent"}</td>
                                                <td className="py-3 px-4 text-sm text-gray-400">{new Date(p.createdAt).toLocaleDateString()}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-4">
                                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</Button>
                                <span className="flex items-center px-3 text-sm text-gray-500">Page {page}/{totalPages}</span>
                                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                            </div>
                        )}
                    </>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}

"use client";

import { useState, useEffect } from "react";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Loader2, Tag, Zap, Bug, AlertTriangle } from "lucide-react";

interface Entry {
    id: string;
    version: string;
    title: string;
    content: string;
    type: string;
    createdAt: string;
}

const typeConfig: Record<string, { icon: typeof Tag; color: string; label: string }> = {
    update: { icon: Tag, color: "bg-blue-100 text-blue-700", label: "Update" },
    feature: { icon: Zap, color: "bg-green-100 text-green-700", label: "Feature" },
    fix: { icon: Bug, color: "bg-orange-100 text-orange-700", label: "Fix" },
    breaking: { icon: AlertTriangle, color: "bg-red-100 text-red-700", label: "Breaking" },
};

export default function ChangelogPage() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/changelog")
            .then((r) => r.json())
            .then((d) => { setEntries(d.entries || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-3xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Changelog</h1>
                <p className="text-gray-500 mb-8">Latest updates and improvements</p>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                ) : entries.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-gray-500">No changelog entries yet</CardContent></Card>
                ) : (
                    <div className="relative">
                        <div className="absolute left-[19px] top-0 bottom-0 w-0.5 bg-gray-200" />
                        <div className="space-y-6">
                            {entries.map((entry) => {
                                const config = typeConfig[entry.type] || typeConfig.update;
                                const Icon = config.icon;
                                return (
                                    <div key={entry.id} className="relative pl-12">
                                        <div className="absolute left-0 top-1 w-10 h-10 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center z-10">
                                            <Icon className="w-4 h-4 text-gray-600" />
                                        </div>
                                        <Card>
                                            <CardContent className="p-5">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${config.color}`}>
                                                        {config.label}
                                                    </span>
                                                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                                                        v{entry.version}
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        {new Date(entry.createdAt).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <h3 className="font-bold text-gray-900 mb-2">{entry.title}</h3>
                                                <div className="text-sm text-gray-600 whitespace-pre-wrap">{entry.content}</div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}

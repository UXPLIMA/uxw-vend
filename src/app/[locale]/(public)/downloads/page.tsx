"use client";

import { useState, useEffect } from "react";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Button } from "@/core/components/ui/button";
import { Loader2, Download, FileText } from "lucide-react";

interface DownloadItem {
    id: string;
    title: string;
    description: string | null;
    fileName: string;
    fileSize: number | null;
    downloads: number;
    createdAt: string;
}

function formatFileSize(bytes: number | null): string {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DownloadsPage() {
    const [downloads, setDownloads] = useState<DownloadItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/v1/downloads")
            .then((r) => r.json())
            .then((d) => { setDownloads(d.downloads || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleDownload = async (id: string) => {
        const res = await fetch(`/api/v1/downloads/${id}`);
        if (res.ok) {
            const data = await res.json();
            window.open(data.url, "_blank");
            // Update count locally
            setDownloads((prev) => prev.map((d) => d.id === id ? { ...d, downloads: d.downloads + 1 } : d));
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-4xl">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Downloads</h1>
                <p className="text-gray-500 mb-8">Resource packs, mods, and other files</p>

                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                ) : downloads.length === 0 ? (
                    <Card><CardContent className="py-12 text-center text-gray-500">No downloads available</CardContent></Card>
                ) : (
                    <div className="space-y-3">
                        {downloads.map((dl) => (
                            <Card key={dl.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium text-gray-900">{dl.title}</h3>
                                        {dl.description && <p className="text-sm text-gray-500 line-clamp-1">{dl.description}</p>}
                                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                                            <span>{dl.fileName}</span>
                                            <span>{formatFileSize(dl.fileSize)}</span>
                                            <span>{dl.downloads} downloads</span>
                                        </div>
                                    </div>
                                    <Button size="sm" onClick={() => handleDownload(dl.id)}>
                                        <Download className="w-4 h-4 mr-2" /> Download
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}

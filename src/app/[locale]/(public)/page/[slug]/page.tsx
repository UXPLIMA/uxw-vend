"use client";

import { useState, useEffect, use } from "react";
import DOMPurify from "dompurify";
import { ThemeSlot } from "@/core/components/theme-slot";
import { HeroBanner, Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Loader2 } from "lucide-react";

interface PageProps {
    params: Promise<{ slug: string }>;
}

interface CustomPage {
    id: string;
    title: string;
    slug: string;
    content: string;
}

export default function CustomPageView({ params }: PageProps) {
    const { slug } = use(params);
    const [page, setPage] = useState<CustomPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        fetch(`/api/v1/custom-pages/${slug}`)
            .then((r) => {
                if (!r.ok) { setNotFound(true); setLoading(false); return null; }
                return r.json();
            })
            .then((d) => { if (d) { setPage(d.page); setLoading(false); } })
            .catch(() => { setNotFound(true); setLoading(false); });
    }, [slug]);

    return (
        <div className="min-h-screen flex flex-col bg-gray-100">
            <ThemeSlot name="HeroBanner" defaultComponent={<HeroBanner />} />
            <ThemeSlot name="Navbar" defaultComponent={<Navbar />} />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-4xl">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
                ) : notFound ? (
                    <Card><CardContent className="py-12 text-center text-gray-500">Page not found</CardContent></Card>
                ) : page ? (
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-6">{page.title}</h1>
                        <Card>
                            <CardContent className="p-8">
                                <div
                                    className="prose prose-blue max-w-none"
                                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }}
                                />
                            </CardContent>
                        </Card>
                    </div>
                ) : null}
            </main>

            <ThemeSlot name="Footer" defaultComponent={<Footer />} />
        </div>
    );
}

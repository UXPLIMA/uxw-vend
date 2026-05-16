"use client";

import { useState, useEffect, use } from "react";
import DOMPurify from "dompurify";
import { Render, type Data, type Config } from "@measured/puck";
import "@measured/puck/puck.css";
import { Navbar, Footer } from "@/core/components/layout";
import { Card, CardContent } from "@/core/components/ui/card";
import { Loader2 } from "lucide-react";
import { buildMergedBlockConfig } from "@/core/lib/blocks-merger";
import { ThemeComponentSlot } from "@/core/components/theme/ThemeComponentSlot";

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
        <div className="min-h-screen flex flex-col bg-muted">
            <Navbar />
            <ThemeComponentSlot name="Hero" />

            <main className="container mx-auto px-4 py-6 flex-1 max-w-4xl">
                {loading ? (
                    <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                ) : notFound ? (
                    <Card><CardContent className="py-12 text-center text-muted-foreground">Page not found</CardContent></Card>
                ) : page ? (
                    <PageContent page={page} />
                ) : null}
            </main>

            <Footer />
        </div>
    );
}

/**
 * Render page content as either Puck blocks (if content parses to valid
 * Puck data) or sanitized HTML (legacy/fallback).
 */
function PageContent({ page }: { page: CustomPage }) {
    const [blockConfig, setBlockConfig] = useState<Config | null>(null);

    let puckData: Data | null = null;
    try {
        const parsed = JSON.parse(page.content || "");
        if (parsed && typeof parsed === "object" && Array.isArray(parsed.content)) {
            puckData = parsed as Data;
        }
    } catch {
        // Not JSON — fall through to HTML render
    }

    useEffect(() => {
        if (puckData) {
            buildMergedBlockConfig().then(setBlockConfig).catch(() => {});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page.content]);

    if (puckData) {
        if (!blockConfig) {
            return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
        }
        return (
            <div>
                <h1 className="text-3xl font-bold text-foreground mb-6">{page.title}</h1>
                <Card>
                    <CardContent className="p-0 overflow-hidden">
                        <Render config={blockConfig} data={puckData} />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-foreground mb-6">{page.title}</h1>
            <Card>
                <CardContent className="p-8">
                    <div
                        className="prose prose-blue max-w-none"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(page.content) }}
                    />
                </CardContent>
            </Card>
        </div>
    );
}

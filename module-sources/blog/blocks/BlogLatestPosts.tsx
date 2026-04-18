"use client";

import React, { useEffect, useState } from "react";
import type { ComponentConfig } from "@measured/puck";

/**
 * Puck page-builder block: BlogLatestPosts
 * Renders the latest N published blog articles, optionally filtered by
 * category. Data is fetched client-side from the module's public API.
 */

interface BlogLatestPostsProps {
    count: number;
    categoryId: string;
    heading: string;
}

interface ArticleSummary {
    id: string;
    slug?: string;
    title: string;
    excerpt?: string | null;
    coverImage?: string | null;
    publishedAt?: string | null;
    category?: { id: string; name: string; slug?: string } | null;
}

function BlogLatestPostsRender({ count, categoryId, heading }: BlogLatestPostsProps): React.ReactElement {
    const [articles, setArticles] = useState<ArticleSummary[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const params = new URLSearchParams();
        params.set("limit", String(count || 3));
        if (categoryId) params.set("categoryId", categoryId);

        let cancelled = false;
        fetch(`/api/v1/blog/articles?${params.toString()}`)
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return;
                const list: ArticleSummary[] = Array.isArray(d) ? d : d.articles || d.data || [];
                setArticles(list.slice(0, count || 3));
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, [count, categoryId]);

    return (
        <section className="container mx-auto px-4 py-8">
            {heading ? (
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">{heading}</h2>
            ) : null}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: count || 3 }).map((_, i) => (
                        <div key={i} className="h-48 rounded-lg bg-muted animate-pulse" />
                    ))}
                </div>
            ) : articles.length === 0 ? (
                <div className="text-muted-foreground text-sm">No articles yet.</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {articles.map((a) => {
                        const href = a.slug ? `/blog/${a.slug}` : `/blog/${a.id}`;
                        return (
                            <a
                                key={a.id}
                                href={href}
                                className="group block bg-card border border-border rounded-lg overflow-hidden hover:border-primary transition-colors"
                            >
                                {a.coverImage ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={a.coverImage}
                                        alt={a.title}
                                        className="w-full h-40 object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-40 bg-muted" />
                                )}
                                <div className="p-4">
                                    {a.category ? (
                                        <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                                            {a.category.name}
                                        </div>
                                    ) : null}
                                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
                                        {a.title}
                                    </h3>
                                    {a.excerpt ? (
                                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{a.excerpt}</p>
                                    ) : null}
                                </div>
                            </a>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

const BlogLatestPosts: ComponentConfig<BlogLatestPostsProps> = {
    fields: {
        count: { type: "number", label: "Number of posts", min: 1, max: 12 },
        categoryId: { type: "text", label: "Category ID (optional)" },
        heading: { type: "text", label: "Section heading" },
    },
    defaultProps: {
        count: 3,
        categoryId: "",
        heading: "Latest Posts",
    },
    render: BlogLatestPostsRender,
};

export default BlogLatestPosts;

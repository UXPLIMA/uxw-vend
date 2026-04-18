"use client";

import React, { useEffect, useState } from "react";
import type { ComponentConfig } from "@measured/puck";

/**
 * Puck page-builder block: BlogCategoryGrid
 * Renders clickable category tiles for all blog categories. Each tile
 * links to the filtered blog list for that category.
 */

interface BlogCategoryGridProps {
    heading: string;
    columns: number;
}

interface BlogCategory {
    id: string;
    name: string;
    slug?: string;
    description?: string | null;
    articleCount?: number;
}

function BlogCategoryGridRender({ heading, columns }: BlogCategoryGridProps): React.ReactElement {
    const [categories, setCategories] = useState<BlogCategory[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/v1/blog/categories`)
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return;
                const list: BlogCategory[] = Array.isArray(d) ? d : d.categories || d.data || [];
                setCategories(list);
                setLoading(false);
            })
            .catch(() => {
                if (!cancelled) setLoading(false);
            });

        return () => { cancelled = true; };
    }, []);

    const colClass =
        columns === 2 ? "md:grid-cols-2" :
        columns === 3 ? "md:grid-cols-3" :
        columns === 4 ? "md:grid-cols-4" :
        "md:grid-cols-3";

    return (
        <section className="container mx-auto px-4 py-8">
            {heading ? (
                <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-6">{heading}</h2>
            ) : null}
            {loading ? (
                <div className={`grid grid-cols-2 ${colClass} gap-4`}>
                    {Array.from({ length: columns || 3 }).map((_, i) => (
                        <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
                    ))}
                </div>
            ) : categories.length === 0 ? (
                <div className="text-muted-foreground text-sm">No categories yet.</div>
            ) : (
                <div className={`grid grid-cols-2 ${colClass} gap-4`}>
                    {categories.map((cat) => {
                        const href = cat.slug ? `/blog?category=${cat.slug}` : `/blog?categoryId=${cat.id}`;
                        return (
                            <a
                                key={cat.id}
                                href={href}
                                className="group flex flex-col items-start justify-between p-4 rounded-lg bg-card border border-border hover:border-primary hover:shadow-sm transition-all"
                            >
                                <div>
                                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                        {cat.name}
                                    </h3>
                                    {cat.description ? (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                            {cat.description}
                                        </p>
                                    ) : null}
                                </div>
                                {typeof cat.articleCount === "number" ? (
                                    <span className="text-xs text-muted-foreground mt-2">
                                        {cat.articleCount} post{cat.articleCount === 1 ? "" : "s"}
                                    </span>
                                ) : null}
                            </a>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

const BlogCategoryGrid: ComponentConfig<BlogCategoryGridProps> = {
    fields: {
        heading: { type: "text", label: "Section heading" },
        columns: {
            type: "select",
            label: "Columns",
            options: [
                { label: "2", value: 2 },
                { label: "3", value: 3 },
                { label: "4", value: 4 },
            ],
        },
    },
    defaultProps: {
        heading: "Browse Categories",
        columns: 3,
    },
    render: BlogCategoryGridRender,
};

export default BlogCategoryGrid;

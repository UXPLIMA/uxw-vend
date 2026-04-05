
"use client";

import { useTranslations } from "next-intl";
import { ThemeSlot } from "@/core/components/theme-slot";
import { NewsCard } from "./news-card";

interface BlogPost {
    id: string;
    number: number;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImage: string | null;
    publishedAt: string | Date | null;
    createdAt: string | Date;
    category: { name: string; slug: string } | null;
}

interface NewsGridProps {
    posts: BlogPost[];
}

export function NewsGrid({ posts }: NewsGridProps) {
    // Default 2-column grid
    return (
        <div className="grid md:grid-cols-2 gap-4">
            {posts.map((post) => (
                <ThemeSlot
                    key={post.id}
                    name="NewsCard"
                    defaultComponent={<NewsCard post={post} />}
                    props={{ post }}
                />
            ))}
        </div>
    );
}

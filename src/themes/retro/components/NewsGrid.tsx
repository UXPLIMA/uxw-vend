
"use client";

import { ThemeSlot } from "@/core/components/theme-slot";
import { NewsCard } from "@/core/components/cards/news-card";

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

export default function RetroNewsGrid({ posts }: NewsGridProps) {
    // 1-column grid for Retro theme
    return (
        <div className="flex flex-col space-y-8">
            {posts.map((post) => (
                <div key={post.id} className="transform hover:scale-[1.02] transition-transform">
                    <ThemeSlot
                        name="NewsCard"
                        defaultComponent={<NewsCard post={post} />}
                        props={{ post }}
                    />
                </div>
            ))}
        </div>
    );
}

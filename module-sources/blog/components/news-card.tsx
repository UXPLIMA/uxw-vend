"use client";

import Link from "next/link";
import Image from "next/image";
import { useLocalDate } from "@/core/hooks/useLocalDate";

interface BlogPost {
    id: string;
    title: string;
    excerpt?: string | null;
    content?: string;
    image?: string | null;
    slug: string;
    publishedAt?: Date | string | null;
    createdAt?: Date | string;
    author?: { username: string } | null;
    category?: { name: string; slug: string } | null;
}

export function NewsCard({ post }: { post: BlogPost }) {
    const formatLocalDate = useLocalDate();
    const date = post.publishedAt || post.createdAt;
    const formattedDate = date ? formatLocalDate(date) : "";

    return (
        <Link href={`/blog/${post.slug}`} className="group block">
            <div className="rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
                {post.image && (
                    <div className="relative aspect-video overflow-hidden">
                        <Image
                            src={post.image}
                            alt={post.title}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                        />
                    </div>
                )}
                <div className="p-4 space-y-2">
                    {post.category && (
                        <span className="text-xs font-medium text-primary">{post.category.name}</span>
                    )}
                    <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
                        {post.title}
                    </h3>
                    {post.excerpt && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{post.excerpt}</p>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                        {post.author && <span>{post.author.username}</span>}
                        {post.author && formattedDate && <span>&middot;</span>}
                        {formattedDate && <span>{formattedDate}</span>}
                    </div>
                </div>
            </div>
        </Link>
    );
}

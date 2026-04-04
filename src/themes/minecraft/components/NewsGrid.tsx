"use client";

import MinecraftNewsCard from "./NewsCard";

interface Post {
    id: string;
    number: number;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImage: string | null;
    publishedAt: string | null;
    createdAt: string;
    category: { name: string; slug: string } | null;
}

export default function MinecraftNewsGrid({ posts }: { posts: Post[] }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((post) => (
                <MinecraftNewsCard key={post.id} post={post} />
            ))}
        </div>
    );
}

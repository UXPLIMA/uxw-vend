"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { formatRelativeTime } from "@/core/lib/utils";

interface NewsCardProps {
    post: {
        id: string;
        number: number;
        title: string;
        slug: string;
        excerpt: string | null;
        coverImage: string | null;
        publishedAt: string | null;
        createdAt: string;
        category: { name: string; slug: string } | null;
    };
}

export default function PixelCraftNewsCard({ post }: NewsCardProps) {
    const date = post.publishedAt || post.createdAt;

    return (
        <Link href={`/blog/${post.number}/${post.slug}`}>
            <div className="group overflow-hidden transition-all hover:-translate-y-1" style={{ background: "#242424", border: "1px solid #3a3a3a", borderRadius: "2px" }}>
                {/* Image */}
                <div className="relative h-44 overflow-hidden" style={{ background: "#1a1a1a" }}>
                    {post.coverImage ? (
                        <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2a2a2a, #1a1a1a)" }}>
                            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "20px", color: "#3a3a3a" }}>?</span>
                        </div>
                    )}
                    {/* Category badge */}
                    {post.category && (
                        <span className="absolute top-2 left-2 px-2 py-1 text-xs font-bold uppercase" style={{ background: "#3ea72d", color: "#fff", borderRadius: "1px", fontSize: "10px" }}>
                            {post.category.name}
                        </span>
                    )}
                </div>

                {/* Content */}
                <div className="p-4">
                    <p className="text-xs mb-2" style={{ color: "#666" }}>
                        {formatRelativeTime(new Date(date))}
                    </p>
                    <h3 className="font-bold mb-2 line-clamp-2 group-hover:text-[#3ea72d] transition-colors" style={{ color: "#e8e8e8", fontSize: "14px" }}>
                        {post.title}
                    </h3>
                    {post.excerpt && (
                        <p className="text-sm line-clamp-2" style={{ color: "#8c8c8c" }}>
                            {post.excerpt}
                        </p>
                    )}
                    <span className="inline-block mt-3 text-xs font-bold uppercase tracking-wider" style={{ color: "#3ea72d" }}>
                        Read More →
                    </span>
                </div>
            </div>
        </Link>
    );
}

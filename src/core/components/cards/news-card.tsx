
"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { Newspaper } from "lucide-react";
import { formatRelativeTime } from "@/core/lib/utils";

// Define the interface here or import it if shared
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

interface NewsCardProps {
    post: BlogPost;
}

export function NewsCard({ post }: NewsCardProps) {
    return (
        <Link href={`/blog/${post.number}/${post.slug}`}>
            <div className="group bg-white rounded-xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
                {/* Image */}
                <div className="relative h-48 overflow-hidden">
                    {post.coverImage ? (
                        <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <Newspaper className="w-10 h-10 text-gray-400" />
                        </div>
                    )}
                    {post.category && (
                        <div className="absolute top-3 right-3">
                            <span className="px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-medium">
                                {post.category.name}
                            </span>
                        </div>
                    )}
                </div>
                {/* Content */}
                <div className="p-4">
                    <p className="text-xs text-gray-500 mb-1">{formatRelativeTime(post.publishedAt || post.createdAt)}</p>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 group-hover:text-blue-600 transition-colors">{post.title}</h3>
                    <p className="text-gray-500 text-xs line-clamp-2">{post.excerpt || ''}</p>
                </div>
            </div>
        </Link>
    );
}

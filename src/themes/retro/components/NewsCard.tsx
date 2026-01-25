
"use client";

import { Link } from "@/core/lib/i18n/navigation";
import { formatRelativeTime } from "@/core/lib/utils";

// Duplicate interface or import - keeping it simple for now by redefining based on usage
interface BlogPost {
    id: string;
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

export default function RetroNewsCard({ post }: NewsCardProps) {
    return (
        <Link href={`/blog/${post.slug}`} className="block h-full">
            <div className="group h-full bg-gray-200 border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 transition-all flex flex-col">
                {/* Retro Image Frame */}
                <div className="relative h-48 border-b-4 border-black overflow-hidden bg-black">
                    {post.coverImage ? (
                        <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-300"
                            style={{ imageRendering: "pixelated" }}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center font-mono text-green-500">
                            [NO_SIGNAL]
                        </div>
                    )}
                    {post.category && (
                        <div className="absolute top-0 right-0 bg-yellow-400 text-black font-bold font-mono text-xs px-2 py-1 border-l-2 border-b-2 border-black">
                            {post.category.name.toUpperCase()}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col font-mono">
                    <div className="text-xs text-gray-500 mb-2 border-b border-gray-400 pb-1 w-full">
                        DATE: {formatRelativeTime(post.publishedAt || post.createdAt)}
                    </div>
                    <h3 className="font-bold text-lg leading-tight mb-2 uppercase group-hover:text-blue-700">
                        {post.title}
                    </h3>
                    <p className="text-gray-600 text-sm line-clamp-3 mb-4 flex-1">
                        {post.excerpt || '...'}
                    </p>
                    <div className="text-right">
                        <span className="inline-block bg-black text-white text-xs px-2 py-1 hover:bg-yellow-400 hover:text-black transition-colors">
                            READ_MORE &gt;&gt;
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    );
}

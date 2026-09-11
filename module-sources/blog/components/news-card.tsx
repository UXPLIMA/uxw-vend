"use client";

import { Link } from "@/core/sdk/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useLocalDate } from "@/core/sdk/ui";

/**
 * One article, drawn the same way wherever it appears.
 *
 * The homepage section and the blog index each had their own card, and the one
 * on the index was wrong twice: it read the picture from `post.image` when an
 * article carries `coverImage`, so the field was always undefined and every
 * card on the index was a bare box - a bug that looks exactly like a site
 * whose authors have not uploaded anything. And it linked to `/blog/<slug>`
 * while every other link in this module is `/blog/<number>/<slug>`.
 *
 * The picture keeps its space when there is none. Two cards side by side
 * should not be different heights depending on who remembered to upload a
 * cover, and the same goes for the title and the excerpt below it.
 */
export interface BlogCardArticle {
    id: string;
    number: number;
    title: string;
    slug: string;
    excerpt?: string | null;
    coverImage?: string | null;
    publishedAt?: Date | string | null;
    createdAt?: Date | string;
    category?: { name: string; slug: string } | null;
}

export function NewsCard({ post }: { post: BlogCardArticle }) {
    const t = useTranslations("blog");
    const formatLocalDate = useLocalDate();
    const date = post.publishedAt || post.createdAt;

    return (
        <Link
            href={`/blog/${post.number}/${post.slug}`}
            className="group block bg-card rounded-lg border border-border overflow-hidden hover:shadow-md transition-all"
        >
            <div className="h-44 bg-muted flex items-center justify-center overflow-hidden">
                {post.coverImage ? (
                    <Image
                        src={post.coverImage}
                        alt={post.title}
                        width={0}
                        height={0}
                        sizes="100vw"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                ) : (
                    <span className="text-muted-foreground text-sm">{t("noImage")}</span>
                )}
            </div>
            <div className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    {post.category && <span className="font-medium text-primary">{post.category.name}</span>}
                    {post.category && date && <span>&middot;</span>}
                    {date && <span>{formatLocalDate(date)}</span>}
                </div>
                {/* Both blocks are clamped at two lines and hold two lines of
                    room whether or not they fill it, so a short headline in one
                    card cannot make its row shorter than the row above. */}
                <h3 className="font-semibold text-foreground mb-1 line-clamp-2 min-h-[3rem] group-hover:text-primary transition-colors">
                    {post.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                    {post.excerpt}
                </p>
            </div>
        </Link>
    );
}

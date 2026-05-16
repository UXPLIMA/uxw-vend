import { prisma } from "@/core/lib/db";

interface BlogArticleCreatedPayload {
    id: string;
    title: string;
    slug: string;
    status: string;
    authorId: string;
}

/**
 * Records a public ActivityFeedItem when a blog article is published.
 * Wired via the blog manifest's `hookListeners` entry on `blog.article.created`.
 */
export default async function onBlogArticleCreated(
    payload: BlogArticleCreatedPayload,
): Promise<void> {
    if (payload.status !== "PUBLISHED") return;
    try {
        await prisma.activityFeedItem.create({
            data: {
                type: "blog.article.created",
                actorId: payload.authorId,
                title: `Published: ${payload.title}`,
                href: `/blog/${payload.slug}`,
                icon: "FileText",
                isPublic: true,
            },
        });
    } catch {
        /* non-fatal */
    }
}

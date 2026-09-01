import { prisma } from "@/core/sdk/server";
import type { HookHandlerFor } from "@/core/sdk";

/**
 * Records a public ActivityFeedItem when a blog article is published.
 * Wired via the blog manifest's `hookListeners` entry on `blog.article.created`.
 *
 * The payload type comes from this module's own hooks.d.ts, so the listener
 * cannot drift from what the emitter promises.
 */
const onBlogArticleCreated: HookHandlerFor<"blog.article.created", "action"> = async (payload) => {
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
};

export default onBlogArticleCreated;

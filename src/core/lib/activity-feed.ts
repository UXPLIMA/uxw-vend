import { prisma } from "@/core/lib/db";
import { addAction } from "@/core/lib/hooks";

/**
 * Cross-module activity feed.
 *
 * Subscribes to common hook events and writes ActivityFeedItem rows.
 * The feed is intentionally simple — modules can also write directly to
 * ActivityFeedItem if they need richer data.
 *
 * registerActivityFeedListeners() is called once at server bootstrap
 * (after bootstrapHooks).
 */

let registered = false;

export function registerActivityFeedListeners(): void {
    if (registered) return;
    registered = true;

    // ─── User events ───
    addAction<{ userId: string; email: string; username: string }>("user.registered", async (payload) => {
        try {
            await prisma.activityFeedItem.create({
                data: {
                    type: "user.registered",
                    actorId: payload.userId,
                    title: `${payload.username || "A new user"} joined`,
                    icon: "UserPlus",
                    isPublic: true,
                },
            });
        } catch { /* non-fatal */ }
    });

    // ─── Blog events ───
    addAction<{ id: string; title: string; slug: string; status: string; authorId: string }>("blog.article.created", async (payload) => {
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
        } catch { /* non-fatal */ }
    });

    // ─── Store events ───
    addAction<{ id: string; orderNumber?: string; userId: string }>("store.order.completed", async (payload) => {
        try {
            await prisma.activityFeedItem.create({
                data: {
                    type: "store.order.completed",
                    actorId: payload.userId,
                    title: `Completed order #${payload.orderNumber || payload.id}`,
                    icon: "ShoppingBag",
                    isPublic: false, // private to user — order details shouldn't be public
                },
            });
        } catch { /* non-fatal */ }
    });
}

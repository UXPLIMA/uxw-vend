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

    // Profile updates — private (only visible to the user in their own feed)
    addAction<{ userId: string; changes: Record<string, unknown> }>("user.profile.updated", async (payload) => {
        try {
            const user = await prisma.user.findUnique({
                where: { id: payload.userId },
                select: { username: true },
            });
            await prisma.activityFeedItem.create({
                data: {
                    type: "user.profile.updated",
                    actorId: payload.userId,
                    title: `${user?.username || "A user"} updated their profile`,
                    icon: "UserCog",
                    isPublic: false,
                },
            });
        } catch { /* non-fatal */ }
    });

    // 2FA enabled — private security audit trail
    addAction<{ userId: string }>("user.2fa.enabled", async (payload) => {
        try {
            await prisma.activityFeedItem.create({
                data: {
                    type: "user.2fa.enabled",
                    actorId: payload.userId,
                    title: "Two-factor authentication enabled",
                    icon: "ShieldCheck",
                    isPublic: false,
                },
            });
        } catch { /* non-fatal */ }
    });

    // 2FA disabled — private security audit trail
    addAction<{ userId: string }>("user.2fa.disabled", async (payload) => {
        try {
            await prisma.activityFeedItem.create({
                data: {
                    type: "user.2fa.disabled",
                    actorId: payload.userId,
                    title: "Two-factor authentication disabled",
                    icon: "ShieldOff",
                    isPublic: false,
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

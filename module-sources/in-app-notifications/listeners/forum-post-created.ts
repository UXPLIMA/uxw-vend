import { shouldNotify } from "@/core/sdk/server";
import { createNotification } from "../lib/notifications";

/**
 * Hook listener: `forum.post.created`.
 *
 * The forum declared this as "Reply on your forum topic" in both languages
 * and nothing listened, so the toggle for it did nothing.
 *
 * The reply's own author is not told about their own reply, and a post held
 * for moderation is not announced: nobody can read it yet, so pointing the
 * topic's author at it would be pointing them at nothing.
 */
export default async function onForumPostCreated(payload: {
    topicId: string;
    authorId: string | null;
    moderationState?: string;
    topicAuthorId: string | null;
    topicTitle: string;
    topicSlug?: string | null;
}): Promise<void> {
    if (payload?.moderationState && payload.moderationState !== "APPROVED") return;
    const recipient = payload?.topicAuthorId;
    if (!recipient || recipient === payload.authorId) return;
    if (!(await shouldNotify(recipient, "forum.post.created", "inapp"))) return;
    await createNotification({
        userId: recipient,
        title: "New reply on your topic",
        message: `Someone replied to "${payload.topicTitle}".`,
        titleKey: "notif_forumReplyTitle",
        messageKey: "notif_forumReplyMessage",
        params: { title: payload.topicTitle },
        type: "info",
        href: `/forum/topic/${payload.topicSlug || payload.topicId}`,
    });
}

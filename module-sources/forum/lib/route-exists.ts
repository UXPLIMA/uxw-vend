import { prisma } from "@/core/sdk/server";
import { auth } from "@/core/sdk/auth";
import { visibleCategoryIds } from "./visible-categories";

/** The lookup segment out of `/forum/topic/<id>/<slug>` or a bare `<id>`. */
function lookupOf(params: Record<string, string | string[]>): string | null {
    const raw = params.params ?? params.slug;
    const segments = typeof raw === "string" ? raw.split("/") : Array.isArray(raw) ? raw : [];
    const idx = segments.indexOf("topic");
    const value = idx >= 0 && segments[idx + 1] ? segments[idx + 1] : segments[0];
    return value || null;
}

/**
 * Does the topic page name a topic? Id, slug and number, the same three the
 * API accepts. Moderation state is deliberately not part of the question: a
 * topic held for review still exists, and its author can see it.
 *
 * Who is asking is part of the question, though. A topic in a section this
 * reader may not open does not name a page for them: answering yes renders a
 * page whose own endpoint then refuses, which is a blank screen rather than a
 * 404, and it is indexable.
 */
export default async function topicExists(params: Record<string, string | string[]>): Promise<boolean> {
    const lookup = lookupOf(params);
    if (!lookup) return false;
    const reader = await auth();
    const readable = await visibleCategoryIds(reader?.user?.role ?? null);

    const topic = await prisma.forumTopic.findFirst({
        where: {
            ...(readable.everything ? {} : { categoryId: { in: readable.categoryIds } }),
            OR: [
                { id: lookup },
                { slug: lookup },
                ...(isNaN(Number(lookup)) ? [] : [{ number: Number(lookup) }]),
            ],
        },
        select: { id: true },
    });
    return topic !== null;
}

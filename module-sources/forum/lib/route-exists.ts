import { prisma } from "@/core/sdk/server";

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
 */
export default async function topicExists(params: Record<string, string | string[]>): Promise<boolean> {
    const lookup = lookupOf(params);
    if (!lookup) return false;
    const topic = await prisma.forumTopic.findFirst({
        where: {
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

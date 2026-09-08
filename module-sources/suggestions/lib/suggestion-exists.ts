import { prisma } from "@/core/sdk/server";

/**
 * Does `/suggestions/<id>` name a suggestion a visitor can read?
 *
 * The page is a client component, so it cannot call `notFound()` itself, and
 * a module page reaches the browser through core's catch-all - by the time
 * the page decides there is nothing here, the status line has gone. Measured
 * on the blog before this pattern existed: `/blog/999999/x` answered 200 with
 * a not-found body, which a crawler indexes and a monitor reads as healthy.
 *
 * A private suggestion, or one waiting for review, is not there as far as a
 * visitor is concerned. Its author and a moderator still reach it: the
 * endpoint behind the page answers them, and this only decides the status.
 */
export default async function suggestionExists(params: Record<string, string | string[]>): Promise<boolean> {
    const raw = params.id ?? params.params;
    const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[raw.length - 1] : "";
    if (!id) return false;

    const suggestion = await prisma.suggestion.findFirst({
        where: { id, visibility: "public", moderationState: "APPROVED" },
        select: { id: true },
    });
    return suggestion !== null;
}

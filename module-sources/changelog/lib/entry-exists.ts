import { prisma } from "@/core/sdk/server";
import { entryNumberFrom } from "./entry-page";

/**
 * Does `/changelog/<number>/<anything>` name a release with a page?
 *
 * The page itself renders a "nothing more to show" state when the lookup finds
 * nothing, which looks like enough and is not: a module page is rendered
 * through core's catch-all, and by the time the component decides, the status
 * line has already gone out as 200. A crawler indexes that, and a monitor
 * reads it as healthy. The module validator refuses a dynamic route without
 * this for exactly that reason.
 *
 * It asks the same three questions the endpoint asks, because a page that
 * exists for a visitor and a page that exists for this check being different
 * things is how a soft 404 comes back: switched on, published by now, and
 * carrying a long form. A release whose whole story fits on the timeline has
 * no page, and a URL naming it names nothing.
 */
export default async function changelogEntryExists(
    params: Record<string, string | string[]>,
): Promise<boolean> {
    const number = entryNumberFrom(params.slug ?? params.params);
    if (!number) return false;

    const entry = await prisma.changelogEntry.findUnique({
        where: { number: Number(number) },
        select: { isActive: true, publishAt: true, details: true },
    });
    if (!entry || !entry.isActive) return false;
    if (entry.publishAt !== null && entry.publishAt > new Date()) return false;
    return typeof entry.details === "string" && entry.details.trim() !== "";
}

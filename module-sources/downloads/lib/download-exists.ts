import { prisma } from "@/core/sdk/server";
import { downloadNumberFrom } from "./guide";

/**
 * Does `/downloads/<number>/<anything>` name a file with a guide?
 *
 * The page renders a not-found state when the lookup finds nothing, and that
 * is not enough: a module page is rendered through core's catch-all, so the
 * status line has gone out as 200 long before the component decides. A crawler
 * indexes that and a monitor reads it as healthy.
 *
 * It asks exactly what the endpoint asks - switched on, and carrying a guide -
 * because a page that exists here and not there is how a soft 404 comes back.
 */
export default async function downloadExists(
    params: Record<string, string | string[]>,
): Promise<boolean> {
    const number = downloadNumberFrom(params.slug ?? params.params);
    if (!number) return false;

    const row = await prisma.download.findUnique({
        where: { number: Number(number) },
        select: { isActive: true, details: true },
    });
    if (!row || !row.isActive) return false;
    return typeof row.details === "string" && row.details.trim() !== "";
}

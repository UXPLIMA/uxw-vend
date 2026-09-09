import { prisma } from "@/core/sdk/server";

/**
 * Whether a slug names a table.
 *
 * Without this the page answers 200 for every slug anybody types, which is a
 * soft 404: indexable, and invisible to a link checker or a monitor watching
 * for a status.
 */
export default async function routeExists(params: Record<string, string | string[]>): Promise<boolean> {
    const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
    if (!slug) return false;
    const table = await prisma.comparisonTable.findFirst({
        where: { slug, isActive: true },
        select: { id: true },
    });
    return table !== null;
}

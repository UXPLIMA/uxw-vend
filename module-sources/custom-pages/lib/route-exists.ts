import { prisma } from "@/core/sdk/server";

/**
 * Does `/page/<slug>` name a published page? Same condition as the API the
 * page calls: a deactivated page is a 404, not an empty frame.
 */
export default async function customPageExists(params: Record<string, string | string[]>): Promise<boolean> {
    const raw = params.slug;
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!slug) return false;
    const page = await prisma.customPage.findFirst({
        where: { OR: [{ slug }, { id: slug }], isActive: true },
        select: { id: true },
    });
    return page !== null;
}

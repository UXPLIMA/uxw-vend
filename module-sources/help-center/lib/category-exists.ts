import { prisma } from "@/core/sdk/server";

/** Does `/help/category/<slug>` name a category? */
export default async function helpCategoryExists(params: Record<string, string | string[]>): Promise<boolean> {
    const raw = params.slug;
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!slug) return false;
    const category = await prisma.helpCategory.findFirst({
        where: { slug },
        select: { id: true },
    });
    return category !== null;
}

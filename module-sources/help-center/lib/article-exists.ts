import { prisma } from "@/core/sdk/server";

/**
 * Does `/help/<slug>` name a live article? An article the admin has
 * deactivated is gone as far as a visitor is concerned, which is what the
 * API says too, so the page says 404 rather than rendering an empty card.
 */
export default async function helpArticleExists(params: Record<string, string | string[]>): Promise<boolean> {
    const raw = params.slug;
    const slug = Array.isArray(raw) ? raw[0] : raw;
    if (!slug) return false;
    const article = await prisma.helpArticle.findFirst({
        where: { slug, isActive: true },
        select: { id: true },
    });
    return article !== null;
}

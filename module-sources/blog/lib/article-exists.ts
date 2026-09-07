import { prisma } from "@/core/sdk/server";
import { publishedArticle } from "./visible-article";

/**
 * Does `/blog/<number-or-slug>/<anything>` name an article a visitor can read?
 *
 * The page is a server component and calls `notFound()` when the lookup finds
 * nothing, which looks like enough and is not: a module page is rendered by
 * core's catch-all through the page registry, and by then the status line has
 * gone. Measured against a production build, `/blog/999999/x` answered 200
 * with a not-found body, which a crawler indexes and a monitor reads as
 * healthy.
 *
 * A draft, or one scheduled for later, is not there yet as far as a visitor
 * is concerned, so this asks the same question the page does.
 */
export default async function blogArticleExists(params: Record<string, string | string[]>): Promise<boolean> {
    const raw = params.params;
    const segments = typeof raw === "string" ? raw.split("/") : Array.isArray(raw) ? raw : [];
    const blogIdx = segments.indexOf("blog");
    const lookup = blogIdx >= 0 && segments[blogIdx + 1] ? segments[blogIdx + 1] : segments[0];
    if (!lookup) return false;

    const num = Number(lookup);
    const article = await prisma.blogArticle.findFirst({
        where: {
            ...(isNaN(num) ? { slug: lookup } : { number: num }),
            ...publishedArticle(),
        },
        select: { id: true },
    });
    return article !== null;
}

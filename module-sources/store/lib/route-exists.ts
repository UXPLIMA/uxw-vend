import { prisma } from "@/core/sdk/server";

/** The lookup segment out of `/store/product/<id>/<slug>` or a bare `<id>`. */
function lookupOf(params: Record<string, string | string[]>): string | null {
    const raw = params.params ?? params.slug;
    const segments = typeof raw === "string" ? raw.split("/") : Array.isArray(raw) ? raw : [];
    const idx = segments.indexOf("product");
    const value = idx >= 0 && segments[idx + 1] ? segments[idx + 1] : segments[0];
    return value || null;
}

/**
 * Does the product page name a product? The three ways in - id, slug and
 * the human-facing number - are the same three the API accepts, so a URL that
 * works in one place is not a 404 in the other.
 */
export default async function productExists(params: Record<string, string | string[]>): Promise<boolean> {
    const lookup = lookupOf(params);
    if (!lookup) return false;
    const product = await prisma.product.findFirst({
        where: {
            OR: [
                { id: lookup },
                { slug: lookup },
                ...(isNaN(Number(lookup)) ? [] : [{ number: Number(lookup) }]),
            ],
        },
        select: { id: true },
    });
    return product !== null;
}

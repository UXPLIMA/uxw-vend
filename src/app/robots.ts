import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { resolveAppUrl } from "@/core/lib/app-url";
import { DISALLOWED_PREFIXES } from "@/core/lib/sitemap-routes";

export default async function robots(): Promise<MetadataRoute.Robots> {
    // `robots.ts` is a Route Handler that Next caches - i.e. prerenders at
    // build time - unless it touches a request-time API. Without the
    // `connection()` below, the canonical URL resolved here would be the one
    // CI had while building the image, so every installation would publish
    // `Sitemap: http://localhost:3001/sitemap.xml`. See
    // node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/robots.md
    await connection();

    // Runtime-resolved from AUTH_URL - see app-url.ts.
    const siteUrl = resolveAppUrl();

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: [...DISALLOWED_PREFIXES],
            },
        ],
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}

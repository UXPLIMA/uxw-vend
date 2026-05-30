import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    // NEXT_PUBLIC_APP_URL is the documented canonical var; NEXT_PUBLIC_SITE_URL
    // is accepted as a fallback for backwards compatibility.
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/admin", "/api", "/auth", "/profile"],
            },
        ],
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

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

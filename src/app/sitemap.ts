import type { MetadataRoute } from "next";

// Revalidate sitemap every hour instead of regenerating on every request
export const revalidate = 3600;

// Core sitemap — only core pages. Module-specific URLs are served by module APIs.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";

    return [
        {
            url: `${baseUrl}/en`,
            lastModified: new Date(),
            changeFrequency: "daily",
            priority: 1,
        },
        {
            url: `${baseUrl}/en/profile`,
            lastModified: new Date(),
            changeFrequency: "monthly",
            priority: 0.5,
        },
    ];
}

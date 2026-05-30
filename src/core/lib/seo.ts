/**
 * SEO helpers — shared across core pages and module pages.
 *
 * Provides:
 *   - buildPageMeta(): Next.js Metadata object with OpenGraph + Twitter cards
 *   - buildArticleJsonLd(): JSON-LD string for Article schema
 *   - buildOrganizationJsonLd(): JSON-LD string for Organization schema
 *
 * Site name + description are sourced from the Settings table with env/serverConfig
 * fallbacks so the helpers work for fresh installs with no DB rows yet.
 */

import type { Metadata } from "next";
import { prisma } from "./db";
import { serverConfig } from "@/core/config/server";

export interface PageMetaInput {
    title: string;
    description?: string;
    image?: string;
    url?: string;
    type?: "website" | "article" | "profile";
    publishedTime?: string;
    authorName?: string;
}

export interface ArticleJsonLdInput {
    title: string;
    description?: string;
    image?: string;
    url: string;
    datePublished?: string;
    dateModified?: string;
    authorName?: string;
}

const SEO_SETTING_KEYS = ["site_name", "site_description"] as const;

interface SeoSiteInfo {
    siteName: string;
    siteDescription: string;
    siteUrl: string;
}

/** Reads site_name + site_description from Settings with env fallbacks. */
async function getSeoSiteInfo(): Promise<SeoSiteInfo> {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

    let siteName: string = serverConfig.name;
    let siteDescription: string = serverConfig.description || "";

    try {
        const rows = await prisma.setting.findMany({
            where: { key: { in: [...SEO_SETTING_KEYS] } },
        });
        for (const r of rows) {
            const value = typeof r.value === "string" ? r.value : String(r.value ?? "");
            if (r.key === "site_name" && value) siteName = value;
            if (r.key === "site_description" && value) siteDescription = value;
        }
    } catch {
        // DB unavailable (build phase / fresh install) — fall back to defaults
    }

    return { siteName, siteDescription, siteUrl };
}

/** Synchronous version using only env/serverConfig — safe for non-async callers. */
function getSeoSiteInfoSync(): SeoSiteInfo {
    return {
        siteName: serverConfig.name,
        siteDescription: serverConfig.description || "",
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001",
    };
}

/**
 * Build a Next.js Metadata object for a page, populated with OpenGraph and
 * Twitter card data. Use from `generateMetadata()` or as a static `metadata`
 * export. Async to allow reading Settings — await the result.
 */
export async function buildPageMeta(input: PageMetaInput): Promise<Metadata> {
    const { siteName, siteDescription, siteUrl } = await getSeoSiteInfo();

    const description = input.description || siteDescription;
    const type = input.type || "website";
    const absoluteUrl = input.url
        ? input.url.startsWith("http") ? input.url : `${siteUrl}${input.url.startsWith("/") ? "" : "/"}${input.url}`
        : undefined;
    const absoluteImage = input.image
        ? input.image.startsWith("http") ? input.image : `${siteUrl}${input.image.startsWith("/") ? "" : "/"}${input.image}`
        : undefined;

    const twitterCard: "summary" | "summary_large_image" = absoluteImage ? "summary_large_image" : "summary";

    return {
        title: input.title,
        description,
        openGraph: {
            title: input.title,
            description,
            type,
            siteName,
            ...(absoluteUrl ? { url: absoluteUrl } : {}),
            ...(absoluteImage ? { images: [{ url: absoluteImage, alt: input.title }] } : {}),
            ...(type === "article" && input.publishedTime ? { publishedTime: input.publishedTime } : {}),
            ...(type === "article" && input.authorName ? { authors: [input.authorName] } : {}),
        },
        twitter: {
            card: twitterCard,
            title: input.title,
            description,
            ...(absoluteImage ? { images: [absoluteImage] } : {}),
        },
    };
}

/**
 * Sync variant of buildPageMeta — uses env/serverConfig only (no DB read).
 * Useful for pages where `metadata` must be a static export and you cannot
 * await. Callers that want Settings values should use the async version.
 */
export function buildPageMetaSync(input: PageMetaInput): Metadata {
    const { siteName, siteDescription, siteUrl } = getSeoSiteInfoSync();

    const description = input.description || siteDescription;
    const type = input.type || "website";
    const absoluteUrl = input.url
        ? input.url.startsWith("http") ? input.url : `${siteUrl}${input.url.startsWith("/") ? "" : "/"}${input.url}`
        : undefined;
    const absoluteImage = input.image
        ? input.image.startsWith("http") ? input.image : `${siteUrl}${input.image.startsWith("/") ? "" : "/"}${input.image}`
        : undefined;
    const twitterCard: "summary" | "summary_large_image" = absoluteImage ? "summary_large_image" : "summary";

    return {
        title: input.title,
        description,
        openGraph: {
            title: input.title,
            description,
            type,
            siteName,
            ...(absoluteUrl ? { url: absoluteUrl } : {}),
            ...(absoluteImage ? { images: [{ url: absoluteImage, alt: input.title }] } : {}),
            ...(type === "article" && input.publishedTime ? { publishedTime: input.publishedTime } : {}),
            ...(type === "article" && input.authorName ? { authors: [input.authorName] } : {}),
        },
        twitter: {
            card: twitterCard,
            title: input.title,
            description,
            ...(absoluteImage ? { images: [absoluteImage] } : {}),
        },
    };
}

/**
 * Build a JSON-LD Article schema string. Drop into a
 * <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ... }} />
 */
export function buildArticleJsonLd(input: ArticleJsonLdInput): string {
    const { siteName, siteUrl } = getSeoSiteInfoSync();
    const absoluteUrl = input.url.startsWith("http") ? input.url : `${siteUrl}${input.url.startsWith("/") ? "" : "/"}${input.url}`;
    const absoluteImage = input.image
        ? input.image.startsWith("http") ? input.image : `${siteUrl}${input.image.startsWith("/") ? "" : "/"}${input.image}`
        : undefined;

    const ld: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: input.title,
        description: input.description,
        mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl },
        publisher: {
            "@type": "Organization",
            name: siteName,
            url: siteUrl,
        },
    };
    if (absoluteImage) ld.image = [absoluteImage];
    if (input.datePublished) ld.datePublished = input.datePublished;
    if (input.dateModified) ld.dateModified = input.dateModified;
    if (input.authorName) {
        ld.author = { "@type": "Person", name: input.authorName };
    }

    // Escape `<` so a value containing `</script>` cannot break out of the
    // surrounding <script type="application/ld+json"> tag.
    return JSON.stringify(ld).replace(/</g, "\\u003c");
}

/**
 * Build a JSON-LD Organization schema string for use in the root layout.
 */
export function buildOrganizationJsonLd(): string {
    const { siteName, siteDescription, siteUrl } = getSeoSiteInfoSync();
    const ld = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: siteName,
        url: siteUrl,
        description: siteDescription,
    };
    // Escape `<` so a value containing `</script>` cannot break out of the
    // surrounding <script type="application/ld+json"> tag.
    return JSON.stringify(ld).replace(/</g, "\\u003c");
}

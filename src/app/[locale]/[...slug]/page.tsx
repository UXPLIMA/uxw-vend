
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleRegistry } from "@/core/generated/module-registry";
import { matchModuleRoute } from "@/core/lib/route-matcher";
import { buildPageMeta } from "@/core/lib/seo";

// export const dynamic = "force-dynamic"; // Removed to support ISR
export const revalidate = 60;

interface PageProps {
    params: Promise<{
        slug: string[];
        locale: string;
    }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Build a generic title for module-rendered pages from the URL slug
 * (e.g. ["blog", "1", "server-launch"] -> "Server Launch"). Modules
 * with richer per-page SEO needs render <script type="application/ld+json">
 * inline so search engines still get full data.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const last = (slug && slug.length > 0 ? slug[slug.length - 1] : "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase()) || "Page";
    const url = "/" + (slug?.join("/") || "");
    return buildPageMeta({
        title: last,
        url,
        type: "article",
    });
}

export default async function DynamicModulePage(props: PageProps) {
    const { params } = props;
    const { slug } = await params;

    const match = matchModuleRoute(slug);

    if (!match) {
        notFound();
    }

    const Component = ModuleRegistry[match.key];

    if (!Component) {
        console.error(`Module component not found in registry: ${match.key}`);
        notFound();
    }

    // Pass params and searchParams to the module page
    // Using a type assertion because we know we are passing valid props
    return <Component {...props} params={Promise.resolve({ ...await params, ...match.params })} />;
}

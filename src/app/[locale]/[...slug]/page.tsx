
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleRegistry } from "@/core/generated/module-page-registry";
import { ModuleRoutes } from "@/core/generated/module-registry";
import { matchModuleRoute } from "@/core/lib/route-matcher";
import { buildPageMeta } from "@/core/lib/seo";
import { moduleRouteTitle } from "@/core/lib/route-title";

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
 * Title a module-rendered page. The name comes from the route the module
 * declared, not from the URL the visitor typed, unless that route declared
 * `titleFromPath` - see `moduleRouteTitle`. Modules with richer per-page SEO
 * needs render <script type="application/ld+json"> inline so search engines
 * still get full data.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const match = matchModuleRoute(slug);
    const route = match ? ModuleRoutes.find((r) => r.key === match.key) : undefined;

    const meta = await buildPageMeta({
        title: moduleRouteTitle(slug, route?.path, route?.titleFromPath),
        url: "/" + (slug?.join("/") || ""),
        type: "article",
    });

    // Nothing serves this path: the component below is about to call
    // `notFound()`. Next renders the not-found page with its own metadata, so
    // this is belt and braces for anything that reads the head before then.
    if (!route) {
        return { ...meta, robots: { index: false, follow: false } };
    }

    // A module can mark a route `noindex` in its manifest: a cart, an order
    // confirmation, anything whose content belongs to one visitor. The same
    // flag keeps the page out of the sitemap.
    if (route.noindex) {
        return { ...meta, robots: { index: false, follow: true } };
    }
    return meta;
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

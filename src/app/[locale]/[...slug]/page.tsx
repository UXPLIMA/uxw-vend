
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleRegistry } from "@/core/generated/module-page-registry";
import { ModuleRoutes } from "@/core/generated/module-registry";
import { ModuleRouteResolvers } from "@/core/generated/module-route-resolvers";
import { matchModuleRoute } from "@/core/lib/route-matcher";
import { buildPageMeta } from "@/core/lib/seo";
import { moduleRouteTitle } from "@/core/lib/route-title";

/**
 * Ask the module whether the URL names anything, when it declared a way to ask.
 *
 * A page that looks its subject up in the browser has already answered 200 by
 * the time it finds nothing, so `/player/nobody` was a soft 404: indexable,
 * and invisible to a link checker or a monitor watching for a status. A route
 * with a `resolver` in its manifest gets the question asked here instead,
 * before anything renders.
 *
 * `cache` keeps it to one call per request even though metadata and the page
 * both ask, and a resolver that throws is treated as "no opinion" rather than
 * turning a database hiccup into a 404 on a page that exists.
 */
const routeExists = cache(async (key: string, params: Record<string, string | string[]>): Promise<boolean> => {
    const load = ModuleRouteResolvers[key];
    if (!load) return true;
    try {
        const { default: resolve } = await load();
        return await resolve(params);
    } catch (err) {
        console.error(`[route-resolver] ${key} failed`, err);
        return true;
    }
});

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

    // Nothing serves this path, or the registry no longer carries the route it
    // matched: the component below is about to call `notFound()`. Next renders
    // the not-found page with its own metadata, so this is belt and braces for
    // anything that reads the head before then.
    if (!match) {
        return { ...meta, robots: { index: false, follow: false } };
    }
    if (!route) {
        return { ...meta, robots: { index: false, follow: false } };
    }

    // The route pattern matches but names nothing. Same treatment: the page is
    // about to 404, and until it does, no crawler should be told to index this.
    if (!(await routeExists(match.key, match.params))) {
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

    if (!(await routeExists(match.key, match.params))) {
        notFound();
    }

    // Pass params and searchParams to the module page
    // Using a type assertion because we know we are passing valid props
    return <Component {...props} params={Promise.resolve({ ...await params, ...match.params })} />;
}

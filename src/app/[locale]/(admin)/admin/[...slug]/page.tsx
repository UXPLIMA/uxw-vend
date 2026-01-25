
import { notFound } from "next/navigation";
import { ModuleRegistry } from "@/core/generated/module-registry";
import { matchModuleRoute } from "@/core/lib/route-matcher";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{
        slug: string[];
        locale: string;
    }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DynamicAdminModulePage(props: PageProps) {
    const { params } = props;
    const { slug } = await params;

    // Construct the full path including /admin prefix for matching
    // slug is ["store", "products"] -> pathSegments should be ["admin", "store", "products"]
    const pathSegments = ["admin", ...slug];

    const match = matchModuleRoute(pathSegments);

    if (!match) {
        // Fallback or explicit notFound
        notFound();
    }

    const Component = ModuleRegistry[match.key];

    if (!Component) {
        console.error(`Module component not found in registry: ${match.key}`);
        notFound();
    }

    return <Component {...props} params={Promise.resolve({ ...await params, ...match.params })} />;
}

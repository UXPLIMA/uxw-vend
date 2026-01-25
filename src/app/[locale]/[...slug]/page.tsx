
import { notFound } from "next/navigation";
import { ModuleRegistry } from "@/core/generated/module-registry";
import { matchModuleRoute } from "@/core/lib/route-matcher";

// export const dynamic = "force-dynamic"; // Removed to support ISR
export const revalidate = 60;

interface PageProps {
    params: Promise<{
        slug: string[];
        locale: string;
    }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
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

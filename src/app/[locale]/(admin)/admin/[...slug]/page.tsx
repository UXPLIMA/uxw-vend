
import { notFound, redirect } from "next/navigation";
import { ModuleRegistry } from "@/core/generated/module-registry";
import { matchModuleRoute } from "@/core/lib/route-matcher";
import { auth } from "@/core/lib/auth";
import { isAdmin } from "@/core/lib/permissions";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{
        slug: string[];
        locale: string;
    }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DynamicAdminModulePage(props: PageProps) {
    const session = await auth();
    if (!session?.user) {
        redirect("/auth/login");
    }

    const admin = await isAdmin(session.user.id);
    if (!admin) {
        redirect("/");
    }

    const { params } = props;
    const { slug } = await params;

    const pathSegments = ["admin", ...slug];
    const match = matchModuleRoute(pathSegments);

    if (!match) {
        notFound();
    }

    const Component = ModuleRegistry[match.key];

    if (!Component) {
        console.error(`Module component not found in registry: ${match.key}`);
        notFound();
    }

    return <Component {...props} params={Promise.resolve({ ...await params, ...match.params })} />;
}

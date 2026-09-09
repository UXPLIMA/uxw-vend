import { apiError, apiSuccess } from "@/core/lib/api-utils";
import { auth } from "@/core/lib/auth";
import { prisma } from "@/core/lib/db";
import { isAdmin } from "@/core/lib/permissions";

/**
 * What the translation editor can be narrowed by.
 *
 * Read from the table rather than from a list in code, because the answer
 * changes with every module installed and core is not allowed to know their
 * names. Two grouped reads over an indexed column, not the catalogue itself.
 */
export async function GET() {
    const session = await auth();
    if (!session?.user?.id) return apiError("Unauthorized", 401);
    if (!(await isAdmin(session.user.id, session.user.role))) return apiError("Forbidden", 403);

    const [modules, namespaces] = await Promise.all([
        prisma.translation.groupBy({ by: ["module"], orderBy: { module: "asc" } }),
        prisma.translation.groupBy({ by: ["namespace"], orderBy: { namespace: "asc" } }),
    ]);

    return apiSuccess({
        modules: modules.map((row) => row.module),
        namespaces: namespaces.map((row) => row.namespace),
    });
}

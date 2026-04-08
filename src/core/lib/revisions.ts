import { prisma } from "@/core/lib/db";

/**
 * Generic content revision tracker.
 *
 * Modules call recordRevision() right BEFORE updating or deleting an entity
 * so the previous state is preserved. The (resource, resourceId) pair
 * identifies the entity; resource is a free-form string by convention
 * `<module>.<entity>`.
 *
 * Example usage in a PATCH route:
 *   const existing = await prisma.blogArticle.findUnique({ where: { id } });
 *   if (!existing) return notFound;
 *   await recordRevision("blog.article", id, existing, "update", session.user.id);
 *   await prisma.blogArticle.update({ where: { id }, data: ... });
 *
 * Listing & restoring is done via /api/v1/revisions endpoints (separate file).
 */

export async function recordRevision(
    resource: string,
    resourceId: string,
    snapshot: unknown,
    action: "update" | "delete" = "update",
    authorId?: string | null
): Promise<void> {
    try {
        await prisma.revision.create({
            data: {
                resource,
                resourceId,
                data: snapshot as object,
                action,
                authorId: authorId || undefined,
            },
        });
    } catch (err) {
        // Non-fatal — revisions are best-effort. Don't break the actual mutation.
        console.error(`[revisions] Failed to record ${resource}/${resourceId}:`, err);
    }
}

/** List revisions for a specific entity, newest first. */
export async function listRevisions(resource: string, resourceId: string, limit = 50) {
    return prisma.revision.findMany({
        where: { resource, resourceId },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { author: { select: { id: true, username: true } } },
    });
}

/** Get a single revision (for restore preview). */
export async function getRevision(id: string) {
    return prisma.revision.findUnique({
        where: { id },
        include: { author: { select: { id: true, username: true } } },
    });
}

/** Prune revisions older than N days for a resource (background job). */
export async function pruneOldRevisions(daysToKeep = 90): Promise<number> {
    const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    const result = await prisma.revision.deleteMany({
        where: { createdAt: { lt: cutoff } },
    });
    return result.count;
}

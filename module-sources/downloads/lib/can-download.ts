import { hasPermission, hasResourcePermission } from "@/core/lib/permissions";

/**
 * Determine whether a user may download a specific file.
 *
 * Access is granted if ANY of the following is true:
 *   1. The user's role has the `downloads.manage` permission (staff bypass).
 *   2. A granular ResourcePermission row exists for the user on this download
 *      (resource = "downloads.download", resourceId = downloadId,
 *       action = "view").
 *
 * Callers that also support role-based gating should still perform their
 * existing role check; this helper is intended to be combined with that
 * check via OR logic (either path grants access).
 */
export async function canDownload(
    userId: string | undefined,
    downloadId: string
): Promise<boolean> {
    if (!userId) return false;

    // 1. Staff / manage bypass.
    if (await hasPermission(userId, "downloads.manage")) return true;

    // 2. Granular per-download ResourcePermission grant.
    return await hasResourcePermission(userId, "downloads.download", "view", downloadId);
}

import { hasPermission, hasResourcePermission } from "@/core/lib/permissions";

/**
 * Determine whether a user may perform an action on a custom form
 * (including its submissions).
 *
 * Access is granted if ANY of the following is true:
 *   1. The user's role has the `custom-forms.manage` permission.
 *   2. A granular ResourcePermission row exists for the user on this form
 *      (resource = "custom-forms.form", resourceId = formId, action = action).
 *
 * Ownership by form creator is not checked here because the CustomForm model
 * does not persist a creator id; add a createdById column and extend this
 * helper if/when that information is required.
 */
export async function canAccessForm(
    userId: string | undefined,
    formId: string,
    action: "view" | "edit" | "delete" = "view"
): Promise<boolean> {
    if (!userId) return false;

    // 1. Role-level manage permission (existing behavior, preserved).
    if (await hasPermission(userId, "custom-forms.manage")) return true;

    // 2. Granular per-entity ResourcePermission grant.
    return await hasResourcePermission(userId, "custom-forms.form", action, formId);
}

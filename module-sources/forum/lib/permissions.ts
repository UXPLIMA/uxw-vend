/**
 * Who may read, write and reply in a forum category.
 *
 * The argument itself lives in the SDK: two modules ask it now and the lines
 * that would drift are the ones deciding who gets in. This file is the forum's
 * own words for it, so a reader here still sees categories.
 */
import { accessByRole, type AccessNode, type AccessRule, type Access } from "@/core/sdk";

export type CategoryNode = AccessNode;
export type { Access };

/** One line of the matrix, in the forum's own words. */
export interface CategoryRule {
    categoryId: string;
    roleId: string;
    canView: boolean;
    canPost: boolean;
    canReply: boolean;
}

export function categoryAccess(
    category: CategoryNode,
    ancestors: CategoryNode[],
    rules: CategoryRule[],
    roleId: string | null,
): Access {
    const shared: AccessRule[] = rules.map((rule) => ({
        containerId: rule.categoryId,
        roleId: rule.roleId,
        canView: rule.canView,
        canPost: rule.canPost,
        canReply: rule.canReply,
    }));
    return accessByRole(category, ancestors, shared, roleId);
}

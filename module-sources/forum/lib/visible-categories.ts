import { prisma } from "@/core/sdk/server";
import { categoryAccess, type CategoryNode, type CategoryRule } from "./permissions";

/**
 * Which categories this reader may see.
 *
 * The one place that answers it. A private category has more than one door -
 * the category page, the topic list, the statistics, the search, the sitemap,
 * a member's profile - and the code that leaks is always a query somebody
 * wrote before the permission existed, which keeps working perfectly.
 *
 * Two reads whatever the answer: the tree and the matrix. Both are small,
 * both change rarely, and both are needed to answer for one category anyway,
 * because a child is judged by its parents as well as itself.
 */
export interface Readable {
    /** The categories this reader may open. */
    categoryIds: string[];
    /** True when nothing is hidden from them, so a caller can skip a filter. */
    everything: boolean;
}

export async function visibleCategoryIds(roleId: string | null): Promise<Readable> {
    const [categories, rules] = await Promise.all([
        prisma.forumCategory.findMany({ select: { id: true, parentId: true }, take: 500 }),
        prisma.forumCategoryPermission.findMany({ take: 2000 }),
    ]);

    // The common case by a distance: no site has a matrix until somebody
    // writes one, and then every reader can skip the filter entirely.
    if (rules.length === 0) {
        return { categoryIds: categories.map((category) => category.id), everything: true };
    }

    const byId = new Map<string, CategoryNode>(categories.map((category) => [category.id, category]));
    const line = (category: CategoryNode): CategoryNode[] => {
        const ancestors: CategoryNode[] = [];
        let at = category.parentId ? byId.get(category.parentId) : undefined;
        // Bounded: a category tree that points at itself would otherwise walk
        // for ever, and a cycle is possible whenever a parent can be edited.
        while (at && ancestors.length < 20) {
            ancestors.push(at);
            at = at.parentId ? byId.get(at.parentId) : undefined;
        }
        return ancestors;
    };

    const matrix = rules as CategoryRule[];
    const visible = categories.filter(
        (category) => categoryAccess(category, line(category), matrix, roleId).view,
    );

    return { categoryIds: visible.map((category) => category.id), everything: false };
}

/** What this reader may do in one category. */
export async function accessToCategory(categoryId: string, roleId: string | null) {
    const [categories, rules] = await Promise.all([
        prisma.forumCategory.findMany({ select: { id: true, parentId: true }, take: 500 }),
        prisma.forumCategoryPermission.findMany({ take: 2000 }),
    ]);

    const byId = new Map<string, CategoryNode>(categories.map((category) => [category.id, category]));
    const here = byId.get(categoryId);
    if (!here) return { view: false, post: false, reply: false };

    const ancestors: CategoryNode[] = [];
    let at = here.parentId ? byId.get(here.parentId) : undefined;
    while (at && ancestors.length < 20) {
        ancestors.push(at);
        at = at.parentId ? byId.get(at.parentId) : undefined;
    }

    return categoryAccess(here, ancestors, rules as CategoryRule[], roleId);
}

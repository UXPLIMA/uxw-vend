/**
 * Who may read, write and reply in a category.
 *
 * The matrix has two silences and they mean opposite things, which is the
 * whole difficulty of it.
 *
 * A category nobody has ruled on is open. Anything else and installing this
 * switches off every category on every existing site: a permission system
 * arriving as an outage.
 *
 * A category where somebody has said who may, and did not say this role, is
 * shut to it. Once an operator has written a list, the list is the answer.
 * Reading silence as permission there means a staff-only section that admits
 * everyone the operator forgot to think about, which is the failure this
 * exists to prevent.
 *
 * Subcategories make it a tree, and a tree has one rule worth more than the
 * rest: a child is never more open than its parent. A private section with
 * public children is the same leak with an extra click, and it is the shape an
 * operator produces by moving a category rather than by writing a rule.
 */

export interface CategoryNode {
    id: string;
    parentId: string | null;
}

/** One line of the matrix: what a role may do in a category. */
export interface CategoryRule {
    categoryId: string;
    roleId: string;
    canView: boolean;
    canPost: boolean;
    canReply: boolean;
}

export interface Access {
    view: boolean;
    post: boolean;
    reply: boolean;
}

const OPEN: Access = { view: true, post: true, reply: true };
const CLOSED: Access = { view: false, post: false, reply: false };

/** What one category's own list says, or null when it has no list. */
function ownAccess(categoryId: string, rules: CategoryRule[], roleId: string | null): Access | null {
    const forCategory = rules.filter((rule) => rule.categoryId === categoryId);
    // No list at all: this category has no opinion, and the answer comes from
    // its parent or from the default.
    if (forCategory.length === 0) return null;

    const mine = roleId === null ? undefined : forCategory.find((rule) => rule.roleId === roleId);
    // A list exists and does not name this role, or there is no role to name.
    if (!mine) return CLOSED;

    // Writing in something you cannot open is not a permission, it is a
    // contradiction, and it would draw a reply box on a page that 404s.
    if (!mine.canView) return CLOSED;

    return { view: true, post: mine.canPost, reply: mine.canReply };
}

/**
 * What this role may do here.
 *
 * `ancestors` is the line from the category's parent upwards, nearest first.
 * Every one of them is asked, and the narrowest answer wins.
 */
export function categoryAccess(
    category: CategoryNode,
    ancestors: CategoryNode[],
    rules: CategoryRule[],
    roleId: string | null,
): Access {
    const line = [category, ...ancestors];

    let allowed: Access | null = null;
    for (const node of line) {
        const said = ownAccess(node.id, rules, roleId);
        if (!said) continue;
        // Narrowest wins: a child may be stricter than its parent and never
        // looser, so each answer can only take permissions away.
        allowed = allowed
            ? {
                view: allowed.view && said.view,
                post: allowed.post && said.post,
                reply: allowed.reply && said.reply,
            }
            : said;
        if (!allowed.view) return CLOSED;
    }

    // Nothing in the whole line has been ruled on.
    if (!allowed) return OPEN;
    return allowed.view ? allowed : CLOSED;
}

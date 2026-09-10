/**
 * What the permission grid sends, and why it cannot just send the ticks.
 *
 * `accessByRole` has two silences that mean opposite things. A category nobody
 * has ruled on is open, because anything else turns installing a permission
 * system into an outage. A category where somebody has written a list, and the
 * list does not name this role, is shut to it, because once an operator has
 * written a list the list is the answer.
 *
 * A grid that sends only its ticked rows walks straight into the gap between
 * them. An operator who unticks every role has said "nobody may be in here";
 * what arrives is an empty list, which reads as "nobody has ruled on this",
 * and the category opens to everybody. The strictest thing the screen can
 * express would produce the loosest thing the site can do, silently, under a
 * green toast.
 *
 * So a role that may do nothing is still a row, and clearing the matrix is a
 * separate act with its own control. That is the only thing that sends
 * nothing.
 *
 * The other correction is the same shape and smaller. `accessByRole` reads
 * "may post but may not view" as nothing at all, because writing in something
 * you cannot open is a contradiction that would draw a reply box on a page
 * that 404s. So the tick is taken back here, where an operator can see it
 * happen, rather than discarded three layers down where they cannot.
 */

export interface MatrixRule {
    roleId: string;
    canView: boolean;
    canPost: boolean;
    canReply: boolean;
}

/**
 * The rows to send for a matrix an operator has written, including the roles
 * they left entirely unticked.
 */
export function normalisedMatrix(draft: readonly MatrixRule[]): MatrixRule[] {
    // Last word wins, because the grid renders one line per role and two lines
    // for one role would be two answers with nothing to choose between them.
    const byRole = new Map<string, MatrixRule>();
    for (const rule of draft) {
        const roleId = rule.roleId.trim();
        if (roleId === "") continue;
        byRole.set(roleId, {
            roleId,
            canView: rule.canView,
            canPost: rule.canView && rule.canPost,
            canReply: rule.canView && rule.canReply,
        });
    }
    return [...byRole.values()];
}

/**
 * Removing the matrix, which hands the category back to whatever its parent
 * says and, failing that, opens it. Deliberately its own function so that
 * "everybody is unticked" and "there is no matrix" cannot be written by the
 * same code path.
 */
export function clearedMatrix(): MatrixRule[] {
    return [];
}

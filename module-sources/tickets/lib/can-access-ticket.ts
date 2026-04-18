import { prisma } from "@/core/lib/db";
import { hasPermission, hasResourcePermission } from "@/core/lib/permissions";

/**
 * Determine whether a user may perform an action on a ticket.
 *
 * Access is granted if ANY of the following is true:
 *   1. The user owns the ticket (ticket.userId === userId) — for view/edit only.
 *   2. The user's role has the `tickets.manage` permission.
 *   3. A granular ResourcePermission row exists for the user on this ticket
 *      (resource = "tickets.ticket", resourceId = ticketId, action = action).
 */
export async function canAccessTicket(
    userId: string | undefined,
    ticketId: string,
    action: "view" | "edit" | "delete" = "view"
): Promise<boolean> {
    if (!userId) return false;

    // 1. Ownership — owners can view/edit their own tickets but not delete.
    if (action !== "delete") {
        const ticket = await prisma.ticket.findUnique({
            where: { id: ticketId },
            select: { userId: true },
        });
        if (ticket?.userId === userId) return true;
    }

    // 2. Role-level manage permission (existing behavior, preserved).
    if (await hasPermission(userId, "tickets.manage")) return true;

    // 3. Granular per-entity ResourcePermission grant.
    return await hasResourcePermission(userId, "tickets.ticket", action, ticketId);
}

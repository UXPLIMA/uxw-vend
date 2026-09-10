/**
 * Which fields on a ticket belong to whom.
 *
 * `canAccessTicket(userId, id, "edit")` answers whether somebody may touch a
 * ticket at all, and the owner passes it because they have to be able to close
 * their own. The update handler read that single yes as permission to write
 * every field on the row, and measured against a production build a plain
 * member set their own ticket to URGENT, assigned it to an admin, assigned it
 * to a different plain member, and marked it RESOLVED.
 *
 * What that costs is the queue. Priority is how a support team decides what to
 * look at first, and it was writable by the person waiting in the line, so
 * everyone picks URGENT and the field stops meaning anything. Assignment says
 * who is responsible, and any account would do - an id belonging to nobody was
 * refused, but being a real person was the whole requirement.
 *
 * So the two questions are separated here. Closing a ticket, or reopening it,
 * is a statement about the reporter's own problem and stays theirs. The states
 * the team works in, the priority and the assignment are the team's.
 *
 * A refusal drops the field rather than failing the request: a screen sends
 * the fields it holds, and losing the one change an owner is entitled to make
 * because of a field they never touched is a worse answer than ignoring it.
 * The caller is told what was dropped so it can say so.
 */

/** Statuses that describe the reporter's problem rather than the team's work. */
export const OWNER_STATUSES = ["OPEN", "CLOSED"] as const;

export interface TicketEditor {
    /** True for anyone holding `tickets.manage`, or an admin. */
    isStaff: boolean;
}

/** The writable shape, as the update schema already parses it. */
export interface TicketChange {
    status?: string;
    priority?: string;
    assignedToId?: string | null;
}

export interface TicketEditDecision {
    /** What may be written, ready to hand to the update. */
    allowed: TicketChange;
    /** Field names that were asked for and are not the caller's to set. */
    refused: string[];
}

export function ticketFieldsFor(editor: TicketEditor, change: TicketChange): TicketEditDecision {
    if (editor.isStaff) {
        const allowed: TicketChange = {};
        if (change.status !== undefined) allowed.status = change.status;
        if (change.priority !== undefined) allowed.priority = change.priority;
        if (change.assignedToId !== undefined) allowed.assignedToId = change.assignedToId;
        return { allowed, refused: [] };
    }

    const allowed: TicketChange = {};
    const refused: string[] = [];

    if (change.status !== undefined) {
        if ((OWNER_STATUSES as readonly string[]).includes(change.status)) {
            allowed.status = change.status;
        } else {
            refused.push("status");
        }
    }
    if (change.priority !== undefined) refused.push("priority");
    if (change.assignedToId !== undefined) refused.push("assignedToId");

    return { allowed, refused };
}

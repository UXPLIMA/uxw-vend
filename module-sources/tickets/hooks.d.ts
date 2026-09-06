/**
 * Payload contract for the hooks this module fires. See blog/hooks.d.ts for
 * why the emitter owns these shapes and what widening/narrowing means.
 */
declare global {
    interface UxwVendHookPayloads {
        "tickets.ticket.opened": TicketHookPayload;
        "tickets.ticket.updated": TicketHookPayload;
        "tickets.ticket.closed": TicketHookPayload;
        // `replied` is the odd one out: it carries the reply as well as the
        // ticket, so listeners can act on the message without a second query.
        "tickets.ticket.replied": {
            ticket: TicketHookPayload;
            message: { id: string; content: string };
            isStaffReply: boolean;
        };
    }
}

interface TicketHookPayload {
    id: string;
    subject: string;
    // Who opened it. Nullable, and not by accident: `user` is
    // `onDelete: SetNull`, so a ticket outlives the account that opened it and
    // a listener with news for its owner may have nobody to tell.
    userId: string | null;
    priority: string;
    user?: { username: string } | null;
    department?: { name: string } | null;
}

export {};

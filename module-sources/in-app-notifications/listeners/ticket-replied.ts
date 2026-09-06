import { shouldNotify } from "@/core/sdk/server";
import { createNotification } from "../lib/notifications";

/**
 * Hook listener: `tickets.ticket.replied`.
 *
 * The tickets module declared this as something a person could be notified
 * about, and named it "Reply to your support ticket" in both languages, but
 * nothing listened: the row in the preferences grid was a switch on nothing.
 *
 * Only a staff reply is news to the person who opened the ticket - their own
 * reply is not. `userId` is nullable, so the ticket may have outlived the
 * account that opened it and there is nobody left to tell.
 */
export default async function onTicketReplied(payload: {
    ticket: { id: string; subject: string; userId: string | null };
    isStaffReply: boolean;
}): Promise<void> {
    if (!payload?.isStaffReply) return;
    const recipient = payload.ticket?.userId;
    if (!recipient) return;
    if (!(await shouldNotify(recipient, "tickets.ticket.replied", "inapp"))) return;
    await createNotification({
        userId: recipient,
        title: "New reply on your ticket",
        message: `Support replied to "${payload.ticket.subject}".`,
        titleKey: "notif_ticketRepliedTitle",
        messageKey: "notif_ticketRepliedMessage",
        params: { subject: payload.ticket.subject },
        type: "info",
        href: `/tickets/${payload.ticket.id}`,
    });
}

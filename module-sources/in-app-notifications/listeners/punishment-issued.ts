import { createNotification } from "../lib/notifications";

/**
 * Hook listener: `punishments.punishment.issued`.
 *
 * `targetUserId` is null when the punished player has no account on the site,
 * which is the ordinary case for a ban issued from in-game.
 */
export default async function onPunishmentIssued(payload: {
    targetUserId: string | null;
    type: string;
    reason?: string | null;
}): Promise<void> {
    if (!payload?.targetUserId) return;
    await createNotification({
        userId: payload.targetUserId,
        title: "A punishment was issued",
        message: payload.reason
            ? `${payload.type}: ${payload.reason}`
            : `A ${payload.type} was issued against your account.`,
        titleKey: "notif_punishmentTitle",
        messageKey: payload.reason ? "notif_punishmentWithReason" : "notif_punishmentMessage",
        params: { type: payload.type, reason: payload.reason ?? "" },
        type: "warning",
        href: "/punishments",
    });
}

import { createNotification } from "../lib/notifications";

/** Hook listener: `credits.credit.added`. */
export default async function onCreditAdded(payload: {
    userId: string;
    amount: number;
}): Promise<void> {
    const amount = Number(payload?.amount);
    if (!payload?.userId || !Number.isFinite(amount)) return;
    await createNotification({
        userId: payload.userId,
        title: "Credits added",
        message: `${amount} credits were added to your balance.`,
        titleKey: "notif_creditsAddedTitle",
        messageKey: "notif_creditsAddedMessage",
        params: { amount },
        type: "success",
        href: "/profile",
    });
}

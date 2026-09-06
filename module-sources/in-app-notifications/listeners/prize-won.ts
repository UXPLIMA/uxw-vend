import { createNotification } from "../lib/notifications";

/** Hook listener: `wheel.prize.won`. */
export default async function onPrizeWon(payload: {
    userId: string;
    prizeName: string;
}): Promise<void> {
    if (!payload?.userId || !payload.prizeName) return;
    await createNotification({
        userId: payload.userId,
        title: "You won a prize",
        message: `You won ${payload.prizeName} on the wheel.`,
        titleKey: "notif_prizeWonTitle",
        messageKey: "notif_prizeWonMessage",
        params: { prize: payload.prizeName },
        type: "success",
        href: "/profile",
    });
}

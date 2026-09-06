import { createNotification } from "../lib/notifications";

/**
 * Hook listener: `referral.referral.used`.
 *
 * The person to tell is the referrer, not the person who just signed up: they
 * are the one who is not looking at the screen.
 */
export default async function onReferralUsed(payload: {
    referrerId: string;
    rewardAmount?: number;
}): Promise<void> {
    if (!payload?.referrerId) return;
    const reward = Number(payload.rewardAmount);
    await createNotification({
        userId: payload.referrerId,
        title: "Your referral code was used",
        message: Number.isFinite(reward) && reward > 0
            ? `Somebody joined with your code. You earned ${reward} credits.`
            : "Somebody joined with your referral code.",
        titleKey: "notif_referralUsedTitle",
        messageKey: Number.isFinite(reward) && reward > 0
            ? "notif_referralUsedReward"
            : "notif_referralUsedMessage",
        params: { reward: Number.isFinite(reward) ? reward : 0 },
        type: "info",
        href: "/profile",
    });
}

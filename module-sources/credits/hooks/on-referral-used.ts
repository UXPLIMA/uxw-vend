import { prisma } from "@/core/lib/db";

/**
 * Declarative hook listener — wired by module.json hookListeners.
 *
 * When the referral module fires `referral.referral.used`, reward the referrer
 * with 50 bonus credits and log a credit transaction.
 */
export default async function onReferralUsed(payload: {
    referrerId: string;
    referredId: string;
    rewardAmount?: number;
}) {
    try {
        await prisma.user.update({
            where: { id: payload.referrerId },
            data: { creditBalance: { increment: 50 } },
        });
        await prisma.creditTransaction.create({
            data: {
                userId: payload.referrerId,
                amount: 50,
                type: "referral_bonus",
                description: `Bonus for referring user`,
            },
        });
    } catch (err) {
        console.error("[credits] Failed to award referral bonus:", err);
    }
}

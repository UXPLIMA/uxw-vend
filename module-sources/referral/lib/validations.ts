import { z } from "zod";

/**
 * Applying somebody's code, and setting what a referral is worth.
 *
 * Both were already type-checked by hand, so what these add is the ceiling:
 * a referral code had no declared length before it reached a Prisma lookup,
 * and a reward amount could be fractional or larger than any balance the
 * store can spend.
 */
export const applyReferralSchema = z.object({
    referralCode: z.string().trim().min(1, "Referral code is required").max(32),
});

export const referralRewardSchema = z.object({
    rewardAmount: z.number().int().min(0).max(100_000),
});

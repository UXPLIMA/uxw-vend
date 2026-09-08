import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * Who invited whom, in each of the three states the screen filters by.
 *
 * One referral per referred account is the schema's own rule, so this walks
 * the accounts in pairs rather than picking at random and colliding.
 */
export const seed: ModuleSeed = {
    run: async (ctx) => {
        const [inviters, invited] = [
            ctx.users.slice(0, Math.floor(ctx.users.length / 2)),
            ctx.users.slice(Math.floor(ctx.users.length / 2)),
        ];
        const statuses = ["pending", "completed", "rewarded"];
        let made = 0;

        for (const [index, user] of invited.entries()) {
            const existing = await ctx.prisma.referral.findUnique({ where: { referredId: user.id } });
            if (existing) continue;
            const status = statuses[index % statuses.length];
            await ctx.create("referral", () => ctx.prisma.referral.create({
                data: {
                    referrerId: inviters[index % inviters.length].id,
                    referredId: user.id,
                    status,
                    rewardAmount: status === "pending" ? 0 : ctx.pick([5, 10, 25]),
                    createdAt: ctx.daysAgo(150),
                },
            }));
            made += 1;
        }
        ctx.log(`${made} referrals`);
    },
};

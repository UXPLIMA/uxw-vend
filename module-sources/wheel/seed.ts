import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * A prize wheel with weights that add up, and a history of spins.
 *
 * The probabilities are deliberately uneven: a wheel where every slice is
 * equally likely never shows whether the weighting works.
 */
const PRIZES: [string, string, number, number, string][] = [
    ["50 credits", "credits", 50, 30, "#3b82f6"],
    ["100 credits", "credits", 100, 20, "#22c55e"],
    ["250 credits", "credits", 250, 10, "#f59e0b"],
    ["Common key", "item", 1, 20, "#06b6d4"],
    ["Rare key", "item", 1, 10, "#a855f7"],
    ["Legendary key", "item", 1, 3, "#eab308"],
    ["Nothing this time", "none", 0, 5, "#6b7280"],
    ["VIP for a day", "rank", 1, 2, "#ef4444"],
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        const prizes: { id: string; name: string; value: number }[] = [];
        for (const [index, [name, type, value, probability, color]] of PRIZES.entries()) {
            const existing = await ctx.prisma.wheelPrize.findFirst({ where: { name } });
            if (existing) { prizes.push(existing); continue; }
            prizes.push(await ctx.create("wheelPrize", () => ctx.prisma.wheelPrize.create({
                data: { name, type, value, probability, color, order: index },
            })));
        }

        let spins = 0;
        for (const user of ctx.users) {
            for (let i = 0; i < ctx.int(0, 6); i++) {
                const prize = ctx.pick(prizes);
                await ctx.create("wheelSpin", () => ctx.prisma.wheelSpin.create({
                    data: {
                        userId: user.id,
                        prizeId: prize.id,
                        prizeName: prize.name,
                        prizeValue: prize.value,
                        createdAt: ctx.daysAgo(60),
                    },
                }));
                spins += 1;
            }
        }
        ctx.log(`${prizes.length} prizes, ${spins} spins`);
    },
};

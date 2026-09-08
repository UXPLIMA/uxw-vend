import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * The voting sites, and a month of votes behind them.
 *
 * The leaderboard's "top voters" tab reads these, so the votes are spread
 * unevenly across people and days rather than one each.
 */
const SITES: [string, string][] = [
    ["Minecraft Server List", "https://minecraft-server-list.example.invalid/vote"],
    ["TopG", "https://topg.example.invalid/vote"],
    ["Planet Minecraft", "https://planetminecraft.example.invalid/vote"],
    ["Minecraft MP", "https://minecraft-mp.example.invalid/vote"],
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        const sites: { id: string }[] = [];
        for (const [index, [name, url]] of SITES.entries()) {
            const existing = await ctx.prisma.voteSite.findFirst({ where: { name } });
            if (existing) { sites.push(existing); continue; }
            sites.push(await ctx.create("voteSite", () => ctx.prisma.voteSite.create({
                data: { name, url, order: index },
            })));
        }

        let votes = 0;
        for (const user of ctx.users) {
            // Most people vote sometimes, a few vote every day, and some
            // never have - which is the spread a leaderboard is meant to show.
            const howMany = ctx.chance(20) ? ctx.int(20, 60) : ctx.int(0, 8);
            for (let i = 0; i < howMany; i++) {
                await ctx.create("voteLog", () => ctx.prisma.voteLog.create({
                    data: {
                        userId: user.id,
                        voteSiteId: ctx.pick(sites).id,
                        createdAt: ctx.daysAgo(30),
                    },
                }));
                votes += 1;
            }
        }
        ctx.log(`${sites.length} sites, ${votes} votes`);
    },
};

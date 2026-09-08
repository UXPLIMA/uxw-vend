import type { ModuleSeed } from "@/core/sdk/seed";

/** One live banner and a couple of retired ones, in each tone. */
const NOTICES: [string, string, string, boolean][] = [
    ["Season 4 starts Friday", "The survival world resets at 18:00 UTC. Your ranks and purchases carry over.", "info", true],
    ["Maintenance on Sunday", "The server will be down for about an hour from 04:00 UTC.", "warning", false],
    ["Store is back", "Payments are working again. Sorry for the wait.", "success", false],
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        for (const [title, content, type, isActive] of NOTICES) {
            const existing = await ctx.prisma.announcement.findFirst({ where: { title } });
            if (existing) continue;
            await ctx.create("announcement", () => ctx.prisma.announcement.create({
                data: { title, content, type, isActive, createdAt: ctx.daysAgo(45) },
            }));
        }
        ctx.log(`${NOTICES.length} announcements`);
    },
};

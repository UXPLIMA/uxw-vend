import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * The two pages nearly every community writes, so the page builder, the
 * footer's legal links and the /page/[slug] route have something behind them.
 */
const PAGES: [string, string, string][] = [
    ["Rules", "rules", "<h2>The short version</h2><p>Be decent to each other. No cheating, no advertising, no griefing.</p><h2>The long version</h2><p>Cheating means any client that plays for you. Advertising means posting another server's address anywhere, including in a private message. Griefing means breaking or taking what someone else built.</p><p>Staff decisions can be appealed once, through a ticket.</p>"],
    ["About us", "about", "<p>This server has been running since 2019, on hardware we pay for out of what the store makes.</p><p>Everyone on the team plays here too. If something is broken, say so - it is the fastest way for it to get fixed.</p>"],
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        for (const [index, [title, slug, content]] of PAGES.entries()) {
            const existing = await ctx.prisma.customPage.findUnique({ where: { slug } });
            if (existing) continue;
            await ctx.create("customPage", () => ctx.prisma.customPage.create({
                data: { title, slug, content, order: index, createdAt: ctx.daysAgo(300) },
            }));
        }
        ctx.log(`${PAGES.length} pages`);
    },
};

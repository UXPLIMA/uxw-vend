import type { ModuleSeed } from "@/core/sdk/seed";

/** Release notes, newest first, of each kind the page colours differently. */
const ENTRIES: [string, string, string][] = [
    ["1.8.0", "Seasonal event and two new crates", "feature"],
    ["1.7.2", "Fixed the shop signs breaking after a restart", "fix"],
    ["1.7.1", "Chat filter no longer eats punctuation", "fix"],
    ["1.7.0", "Auction house, and a search that works", "feature"],
    ["1.6.3", "Security: session cookies are rotated on sign-in", "security"],
    ["1.6.2", "Faster world loading on the survival server", "improvement"],
    ["1.6.0", "Ranks are applied the moment a payment clears", "feature"],
    ["1.5.4", "Removed the old /warp command", "removed"],
    ["1.5.0", "New spawn, new tutorial", "feature"],
    ["1.4.1", "Backups now run twice a day", "improvement"],
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        for (const [index, [version, title, type]] of ENTRIES.entries()) {
            const existing = await ctx.prisma.changelogEntry.findFirst({ where: { version } });
            if (existing) continue;
            await ctx.create("changelogEntry", () => ctx.prisma.changelogEntry.create({
                data: {
                    version,
                    title,
                    content: ctx.html(ctx.int(1, 3)),
                    type,
                    createdAt: ctx.daysAgo(30 + index * 25),
                },
            }));
        }
        ctx.log(`${ENTRIES.length} releases`);
    },
};

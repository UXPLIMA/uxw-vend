import type { ModuleSeed } from "@/core/sdk/seed";
import type { ChangelogType } from "./lib/types";

/** Release notes, newest first, of each kind the page colours differently. */
interface Release {
    version: string;
    title: string;
    type: ChangelogType;
}

/** Release notes, newest first, one of each kind the page colours. */
const ENTRIES: Release[] = [
    { version: "1.8.0", title: "Seasonal event and two new crates", type: "feature" },
    { version: "1.7.2", title: "Fixed the shop signs breaking after a restart", type: "fix" },
    { version: "1.7.1", title: "Chat filter no longer eats punctuation", type: "fix" },
    { version: "1.7.0", title: "Auction house, and a search that works", type: "feature" },
    { version: "1.6.3", title: "Session cookies are rotated on sign-in", type: "security" },
    { version: "1.6.2", title: "Faster world loading on the survival server", type: "improvement" },
    { version: "1.6.0", title: "Ranks are applied the moment a payment clears", type: "feature" },
    { version: "1.5.4", title: "The old /warp command is gone", type: "removed" },
    { version: "1.5.0", title: "New spawn, new tutorial", type: "feature" },
    { version: "1.4.1", title: "Backups now run twice a day", type: "improvement" },
    { version: "1.4.0", title: "Ranks are no longer inherited by alt accounts", type: "breaking" },
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        for (const [index, { version, title, type }] of ENTRIES.entries()) {
            const existing = await ctx.prisma.changelogEntry.findFirst({ where: { version } });
            if (existing) continue;
            await ctx.create("changelogEntry", () => ctx.prisma.changelogEntry.create({
                data: {
                    version,
                    title,
                    content: ctx.html(ctx.int(1, 3)),
                    type,
                    // A changelog is read in order, so the dates are stepped
                    // rather than scattered: `daysAgo` is weighted towards now
                    // and would shuffle the releases into each other.
                    createdAt: new Date(Date.now() - (14 + index * 23) * 86_400_000),
                },
            }));
        }
        ctx.log(`${ENTRIES.length} releases`);
    },
};

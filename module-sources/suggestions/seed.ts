import type { ModuleSeed } from "@/core/sdk/seed";
import { SUGGESTION_STATUSES } from "./lib/statuses";

/**
 * A suggestion board with votes on it.
 *
 * Vote counts have to differ, or "most voted" and "newest" sort into the same
 * order and neither is tested. Every status is represented so the filter
 * strip has something behind each chip.
 */
const IDEAS = [
    "Add an /afk command",
    "Bring back the old spawn",
    "Let us rename pets",
    "A second auction house on the survival world",
    "Discord roles that follow the in-game rank",
    "Show playtime on the profile page",
    "More storage in the vault",
    "Weekly build contests",
    "A public test server before big updates",
    "Let us hide our stats from the leaderboard",
    "Cheaper keys when you buy ten",
    "An in-game mail system",
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        const howMany = Math.min(IDEAS.length * 2, 4 * ctx.scale);
        let votes = 0;

        for (let i = 0; i < howMany; i++) {
            const base = IDEAS[i % IDEAS.length];
            const suggestion = await ctx.create("suggestion", () => ctx.prisma.suggestion.create({
                data: {
                    title: i < IDEAS.length ? base : `${base} (${Math.floor(i / IDEAS.length) + 1})`,
                    content: ctx.html(ctx.int(1, 2)),
                    // Most boards are mostly open; the rest give every filter
                    // chip something to show.
                    // The module's own vocabulary, so the board's filter
                    // chips each have something behind them and no row lands
                    // in a state nothing renders.
                    status: ctx.chance(55) ? "open" : ctx.pick(SUGGESTION_STATUSES),
                    authorId: ctx.pick(ctx.users).id,
                    createdAt: ctx.daysAgo(180),
                },
            }));

            const voters = ctx.some(ctx.users, ctx.int(0, ctx.users.length - 1));
            for (const voter of voters) {
                await ctx.create("suggestionVote", () => ctx.prisma.suggestionVote.create({
                    data: { suggestionId: suggestion.id, userId: voter.id },
                }));
            }
            // The board reads `upvotes`; the votes table is what stops one
            // person voting twice. Both have to agree.
            await ctx.prisma.suggestion.update({
                where: { id: suggestion.id },
                data: { upvotes: voters.length },
            });
            votes += voters.length;
        }

        ctx.log(`${howMany} suggestions, ${votes} votes`);
    },
};

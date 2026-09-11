import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * The cards a community puts on its front page.
 *
 * Each one points somewhere the site already goes, because a showcase card
 * whose link is a dead end is the first thing a visitor clicks and the first
 * disappointment they have. Two carry no picture on purpose: the card reserves
 * that space either way and a demo where every card has one shows nothing of
 * what the layout does when an operator has not uploaded anything.
 */
const CARDS: { title: string; body: string; href: string; image?: string }[] = [
    {
        title: "Join the server",
        body: "The address, the version, and what to install before you connect.",
        href: "/downloads",
        image: "/demo/cover-guide.svg",
    },
    {
        title: "What changed this week",
        body: "Every release, newest first, with the notes worth reading.",
        href: "/changelog",
        image: "/demo/cover-release.svg",
    },
    {
        title: "Read the news",
        body: "Events, contests and the occasional apology.",
        href: "/blog",
        image: "/demo/cover-update.svg",
    },
    {
        title: "Ask for help",
        body: "The help centre first, and a ticket if that did not cover it.",
        href: "/help",
    },
    {
        title: "Suggest something",
        body: "The board is read every week and the good ones get built.",
        href: "/suggestions",
    },
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        for (const [order, card] of CARDS.entries()) {
            const existing = await ctx.prisma.showcaseCard.findFirst({ where: { title: card.title } });
            if (existing) continue;
            await ctx.create("showcaseCard", () => ctx.prisma.showcaseCard.create({
                data: {
                    title: card.title,
                    body: card.body,
                    href: card.href,
                    image: card.image ?? null,
                    order,
                    createdAt: ctx.daysAgo(120),
                },
            }));
        }
        ctx.log(`${CARDS.length} showcase cards`);
    },
};

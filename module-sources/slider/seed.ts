import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * Three slides, because one is not a slider.
 *
 * The widget is the first thing on the homepage and it draws a 21:9 image
 * with the title over it. With no rows the homepage opened on whatever came
 * second, so nothing about the site's own first screen could be judged - and
 * the arrows and the dots, which only exist once there is more than one
 * slide, were never on screen at all.
 *
 * One slide has no link, which is the other branch: a slide that is a picture
 * rather than a way somewhere.
 */
const SLIDES: [string, string, string, string | null][] = [
    ["Season 4 is live", "New world, same ranks. Everything you own carries over.", "/demo/slide-01.svg", "/store"],
    ["Read what changed", "Every release, written down.", "/demo/slide-02.svg", "/changelog"],
    ["Built by the people here", "Screenshots, guides and the odd disaster.", "/demo/slide-03.svg", null],
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        for (const [index, [title, subtitle, image, link]] of SLIDES.entries()) {
            const existing = await ctx.prisma.sliderItem.findFirst({ where: { title } });
            if (existing) continue;
            await ctx.create("sliderItem", () => ctx.prisma.sliderItem.create({
                data: { title, subtitle, image, link, order: index, isActive: true },
            }));
        }
        ctx.log(`${SLIDES.length} slides`);
    },
};

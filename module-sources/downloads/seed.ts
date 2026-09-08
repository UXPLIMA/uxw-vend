import type { ModuleSeed } from "@/core/sdk/seed";

/** The files a community actually hands out, with plausible sizes. */
const FILES: [string, string, string, number][] = [
    ["Modpack (client)", "Everything you need to join, in one folder.", "server-modpack-1.8.0.zip", 384_000_000],
    ["Resource pack", "Our textures. Optional but recommended.", "resource-pack-v9.zip", 46_000_000],
    ["Map: last season's world", "The survival world as it was at the end of season 3.", "season-3-world.zip", 1_900_000_000],
    ["Launcher", "Starts the game with the right settings.", "launcher-setup.exe", 62_000_000],
    ["Schematics pack", "Build templates from the contest winners.", "schematics.zip", 12_400_000],
    ["Server rules (PDF)", "The rules, in one page.", "rules.pdf", 240_000],
];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        for (const [title, description, fileName, fileSize] of FILES) {
            const existing = await ctx.prisma.download.findFirst({ where: { fileName } });
            if (existing) continue;
            await ctx.create("download", () => ctx.prisma.download.create({
                data: {
                    title,
                    description,
                    fileName,
                    fileUrl: `https://cdn.example.invalid/${fileName}`,
                    fileSize,
                    downloads: ctx.int(20, 9000),
                    createdAt: ctx.daysAgo(300),
                },
            }));
        }
        ctx.log(`${FILES.length} downloads`);
    },
};

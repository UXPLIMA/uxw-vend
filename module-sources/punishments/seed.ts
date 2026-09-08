import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * A punishment log with every kind of entry in it.
 *
 * The public list filters by type and pages, and a row can be permanent,
 * timed, expired or lifted - so the seed writes all four. Names come from the
 * demo accounts where it can, because a log full of players nobody has heard
 * of reads as fake even when it is.
 */
const REASONS: Record<string, string[]> = {
    ban: ["Cheating - killaura", "Cheating - x-ray", "Ban evasion", "Advertising another server"],
    tempban: ["Griefing spawn", "Repeated toxicity", "Duping items"],
    mute: ["Spam in chat", "Insulting another player", "Advertising in chat"],
    tempmute: ["Caps spam", "Arguing with staff in public chat"],
    kick: ["AFK on a full server", "Warning ignored"],
    warning: ["First offence - mild toxicity", "Building too close to spawn"],
};

const DURATIONS: Record<string, string | null> = {
    ban: null, tempban: "7d", mute: null, tempmute: "12h", kick: null, warning: null,
};

export const seed: ModuleSeed = {
    run: async (ctx) => {
        const types = Object.keys(REASONS);
        const howMany = 6 * ctx.scale;
        const staff = ctx.users.filter((u) => u.rolePriority > 0);

        for (let i = 0; i < howMany; i++) {
            const type = types[i % types.length];
            const createdAt = ctx.daysAgo(200);
            const temporary = type.startsWith("temp");
            const expiresAt = temporary
                ? new Date(createdAt.getTime() + ctx.int(1, 30) * 86_400_000)
                : null;
            await ctx.create("punishment", () => ctx.prisma.punishment.create({
                data: {
                    playerName: ctx.pick(ctx.users).username,
                    type,
                    reason: ctx.pick(REASONS[type]),
                    duration: DURATIONS[type],
                    // An expired or lifted punishment is what "active" is
                    // there to tell apart, so a quarter of them are not.
                    active: expiresAt ? expiresAt > new Date() : ctx.chance(75),
                    punishedBy: staff.length ? ctx.pick(staff).username : null,
                    createdAt,
                    expiresAt,
                },
            }));
        }

        ctx.log(`${howMany} punishments across ${types.length} types`);
    },
};

import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * The team page, filled from the accounts that carry a staff role.
 *
 * Tied to real users rather than invented names, so the avatars, the profile
 * links and the "who is online" slot all point at somebody who exists.
 */
const TITLES = ["Owner", "Administrator", "Head moderator", "Moderator", "Moderator", "Builder", "Support"];

export const seed: ModuleSeed = {
    run: async (ctx) => {
        const staff = ctx.users.filter((u) => u.rolePriority > 0);
        const team = staff.length >= 3 ? staff : ctx.users.slice(0, 5);

        for (const [index, member] of team.entries()) {
            const existing = await ctx.prisma.staffMember.findFirst({ where: { userId: member.id } });
            if (existing) continue;
            await ctx.create("staffMember", () => ctx.prisma.staffMember.create({
                data: {
                    userId: member.id,
                    name: member.username,
                    role: TITLES[Math.min(index, TITLES.length - 1)],
                    order: index,
                },
            }));
        }
        ctx.log(`${team.length} team members`);
    },
};

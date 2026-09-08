import type { ModuleSeed } from "@/core/sdk/seed";

/**
 * A support desk mid-shift.
 *
 * Every status has tickets in it, some assigned and some not, and the
 * conversations alternate between the member and the staff reply - which is
 * what the thread view, the status filter and the "waiting on us" counts are
 * for. A queue of five identical open tickets shows none of that.
 */
const DEPARTMENTS: [string, string, string][] = [
    ["General", "Anything that does not fit the others.", "#3b82f6"],
    ["Purchases", "Payments, ranks and missing items.", "#22c55e"],
    ["Bug reports", "Something is broken.", "#f97316"],
    ["Appeals", "Bans and mutes.", "#ef4444"],
];

const SUBJECTS = [
    "Rank not applied after purchase",
    "Cannot log in since yesterday",
    "Items missing after the restart",
    "Payment taken twice",
    "Ban appeal - kicked for flying",
    "How do I change my username?",
    "Shop is showing the wrong price",
    "Chat is muted and I do not know why",
    "Refund for the wrong package",
    "My plot was deleted",
];

const MEMBER_LINES = [
    "It has been a few hours now and still nothing.",
    "I have tried relogging twice.",
    "Order number is in the receipt I attached.",
    "Any update on this?",
    "That worked, thank you.",
    "It is happening again today.",
];

const STAFF_LINES = [
    "Thanks for the details, taking a look now.",
    "I can see the payment on our side. Applying it manually.",
    "Could you tell us which world you were in when it happened?",
    "This is fixed in the update going out tonight.",
    "Reopening this if it comes back, but it looks resolved.",
    "Passing this to the team that owns the plugin.",
];

const STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_REPLY", "RESOLVED", "CLOSED"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const seed: ModuleSeed = {
    run: async (ctx) => {
        const departments: { id: string }[] = [];
        for (const [index, [name, description, color]] of DEPARTMENTS.entries()) {
            const existing = await ctx.prisma.ticketDepartment.findFirst({ where: { name } });
            if (existing) { departments.push(existing); continue; }
            departments.push(await ctx.create("ticketDepartment", () => ctx.prisma.ticketDepartment.create({
                data: { name, description, color, order: index },
            })));
        }

        const staff = ctx.users.filter((u) => u.rolePriority > 0);
        const howMany = Math.min(SUBJECTS.length * 4, 5 * ctx.scale);
        let messages = 0;

        for (let i = 0; i < howMany; i++) {
            const base = SUBJECTS[i % SUBJECTS.length];
            const status = STATUSES[i % STATUSES.length];
            const createdAt = ctx.daysAgo(90);
            const member = ctx.pick(ctx.users);
            const closed = status === "RESOLVED" || status === "CLOSED";
            const ticket = await ctx.create("ticket", () => ctx.prisma.ticket.create({
                data: {
                    subject: i < SUBJECTS.length ? base : `${base} (${Math.floor(i / SUBJECTS.length) + 1})`,
                    status,
                    priority: ctx.pick(PRIORITIES),
                    departmentId: ctx.pick(departments).id,
                    userId: member.id,
                    // An unassigned queue is a real state, so a quarter stay
                    // that way rather than every ticket having an owner.
                    assignedToId: staff.length && ctx.chance(75) ? ctx.pick(staff).id : null,
                    createdAt,
                    closedAt: closed ? new Date(createdAt.getTime() + ctx.int(2, 96) * 3_600_000) : null,
                },
            }));

            let when = createdAt.getTime();
            const turns = ctx.int(1, 5);
            for (let m = 0; m < turns; m++) {
                const fromStaff = m % 2 === 1;
                const author = fromStaff && staff.length ? ctx.pick(staff) : member;
                await ctx.create("ticketMessage", () => ctx.prisma.ticketMessage.create({
                    data: {
                        // Plain text: the thread renders what it is given and
                        // the reply box is a textarea, so markup written here
                        // reaches the reader as markup.
                        content: m === 0 ? `${ctx.sentence()} ${ctx.sentence()}` : ctx.pick(fromStaff ? STAFF_LINES : MEMBER_LINES),
                        isStaffReply: fromStaff,
                        ticketId: ticket.id,
                        userId: author.id,
                        createdAt: new Date(when),
                    },
                }));
                when += ctx.int(1, 30) * 3_600_000;
                messages += 1;
            }
        }

        ctx.log(`${howMany} tickets across ${departments.length} departments, ${messages} messages`);
    },
};

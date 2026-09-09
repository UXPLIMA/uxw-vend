import { prisma } from "./db";
import { restrictedFrom, type Restriction } from "./restrictions";

/**
 * Whether this member is kept out of a part of the site.
 *
 * The read is here and the decision is next door, so the rules can be argued
 * about without a database. Lapsed rows are left in the table rather than
 * swept: an operator looking at somebody's history wants to see the month they
 * spent out of the tickets, and the decision ignores them anyway.
 */
export async function isRestrictedFrom(userId: string, scope: string): Promise<boolean> {
    const rows = await prisma.userRestriction.findMany({
        where: { userId },
        select: { scope: true, expiresAt: true },
        take: 100,
    });
    return restrictedFrom(scope, rows as Restriction[]);
}

/** Everything currently against this member, for a screen that shows it. */
export async function restrictionsOn(userId: string) {
    return prisma.userRestriction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
    });
}

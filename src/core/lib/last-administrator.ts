/**
 * The one question asked before an account loses its authority.
 *
 * The setup wizard creates exactly one administrator, so on a fresh install
 * that account is the only thing that can reach the admin panel. Nothing
 * checked before taking it away: measured against a production build, an admin
 * banned themselves and then demoted themselves to member, both answered 200,
 * and no code anywhere counted how many administrators were left.
 *
 * On a single-admin install that is a mis-click with no way back through any
 * screen this product ships. Recovery means opening the database by hand,
 * which for something distributed as an image is the difference between a bad
 * afternoon and a support ticket nobody can answer.
 *
 * Ban, demotion and deletion all reduce to the same question, and so does an
 * administrator deleting their own account from the profile screen. Keeping it
 * in one function is what makes the fourth path impossible to forget - see
 * the-last-administrator-cannot-be-removed.test.ts, which fails the build if a
 * writer stops asking.
 */
import { prisma } from "@/core/lib/db";

/** What the account being changed looks like right now. */
export interface AdminStanding {
    isAdmin: boolean;
    isBanned: boolean;
    isDeleted: boolean;
}

/**
 * True when removing this account's authority would leave nobody able to
 * administer the site.
 *
 * `usable` is how many accounts are administrators and can actually sign in.
 * A banned or deleted administrator is not cover: counting one would leave a
 * locked-out install with a reassuring number in it.
 */
export function removalWouldStrandTheSite(account: AdminStanding, usable: number): boolean {
    // Not one of the accounts holding the site up, so nothing changes by
    // taking something from it.
    if (!account.isAdmin || account.isBanned || account.isDeleted) return false;

    // A count of zero while this account is usable means the count and the row
    // disagree. Refusing costs one confusing error message; allowing it is the
    // outcome this exists to prevent.
    return usable <= 1;
}

/** How many accounts are administrators and can still sign in. */
async function usableAdministrators(): Promise<number> {
    return prisma.user.count({
        where: {
            isBanned: false,
            isDeleted: false,
            role: { name: "admin" },
        },
    });
}

/**
 * The whole check, for a writer that is about to take an account's authority.
 * Returns true when the write must be refused.
 */
export async function wouldStrandTheSite(userId: string): Promise<boolean> {
    const account = await prisma.user.findUnique({
        where: { id: userId },
        select: { isBanned: true, isDeleted: true, role: { select: { name: true } } },
    });
    if (!account) return false;

    const standing: AdminStanding = {
        isAdmin: account.role?.name === "admin",
        isBanned: account.isBanned,
        isDeleted: account.isDeleted,
    };

    // The count is only asked for when the answer can depend on it. Both
    // arguments of a call are evaluated before it runs, so passing the count
    // in directly would query on every deletion of every ordinary member.
    if (!standing.isAdmin || standing.isBanned || standing.isDeleted) return false;

    return removalWouldStrandTheSite(standing, await usableAdministrators());
}

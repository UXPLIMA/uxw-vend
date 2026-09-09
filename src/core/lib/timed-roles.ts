import { prisma } from "./db";
import { log } from "./logger";

/**
 * A role held for a while, and what happens when the while is up.
 *
 * A member holds one role, so giving one out for thirty days means remembering
 * what they held before and putting it back. Nothing in the platform did: a
 * rank sold by the month was a rank sold once.
 *
 * The grant is written by whoever hands the role out and swept here, which is
 * the only place that has to know how a role is put back. Who granted it is a
 * string the caller chooses: this file never names one.
 *
 * The sweep runs unattended over every account, and it can be wrong in two
 * directions that cost the opposite things. Leaving a role in place lets
 * somebody keep what they stopped paying for. Taking the wrong one away
 * silently undoes an operator's own promotion, months after they made it. The
 * decision below is what keeps it to the first kind of mistake only: a member
 * who no longer holds the granted role is left exactly as they are.
 */

/** What was handed out, and what to put back. */
export interface TimedGrant {
    userId: string;
    roleId: string;
    previousRoleId: string | null;
}

/** The member, as far as this decision is concerned. */
export interface RoleHolder {
    roleId: string | null;
}

/** The site's own answers: which roles exist, and which one is the default. */
export interface RoleWorld {
    defaultRoleId: string | null;
    existingRoleIds: Set<string>;
}

/**
 * The role a member should be left with once a grant lapses, or null when the
 * sweep should not touch them.
 *
 * Null covers two different cases on purpose, because both mean "write
 * nothing": the member has moved on from the granted role, and putting back
 * what they already hold.
 */
export function roleAfterLapse(
    grant: TimedGrant,
    holder: RoleHolder,
    world: RoleWorld,
): { roleId: string | null } | null {
    // Somebody else decided where they are now. A purchase from months ago
    // does not get to overrule that.
    if (holder.roleId !== grant.roleId) return null;

    const previous = grant.previousRoleId && world.existingRoleIds.has(grant.previousRoleId)
        ? grant.previousRoleId
        : world.defaultRoleId;

    // Putting back what they already hold is a write nobody needs and a line
    // in the log nobody can read.
    if (previous === holder.roleId) return null;

    return { roleId: previous ?? null };
}

/**
 * Take back every role whose time is up.
 *
 * Read then decide then write, one member at a time, because each decision
 * depends on that member's current role. The numbers are small by nature - a
 * grant lapses once - and the query is bounded by the index on `expiresAt`.
 *
 * A lapsed grant is deleted whether or not it changed anything: it has done
 * its job either way, and leaving it makes the sweep read it again for ever.
 */
export async function sweepLapsedRoles(now: Date = new Date()): Promise<number> {
    const lapsed = await prisma.timedRoleGrant.findMany({
        where: { expiresAt: { lte: now } },
        select: { id: true, userId: true, roleId: true, previousRoleId: true },
        take: 500,
    });
    if (lapsed.length === 0) return 0;

    const roles = await prisma.role.findMany({ select: { id: true, isDefault: true } });
    const world: RoleWorld = {
        defaultRoleId: roles.find((role) => role.isDefault)?.id ?? null,
        existingRoleIds: new Set(roles.map((role) => role.id)),
    };

    const holders = await prisma.user.findMany({
        where: { id: { in: [...new Set(lapsed.map((grant) => grant.userId))] } },
        select: { id: true, roleId: true },
    });
    const heldBy = new Map(holders.map((user) => [user.id, user.roleId]));

    let reverted = 0;
    for (const grant of lapsed) {
        const holder = heldBy.get(grant.userId);
        // The account was deleted between the grant and the sweep. The grant
        // still goes, below.
        if (holder === undefined) continue;

        const next = roleAfterLapse(grant, { roleId: holder }, world);
        if (!next) continue;
        // `updateMany` rather than `update`: an account deleted between the
        // read above and this write must not throw and abandon the rest of
        // the sweep.
        const done = await prisma.user.updateMany({
            where: { id: grant.userId },
            data: { roleId: next.roleId },
        });
        reverted += done.count;
    }

    await prisma.timedRoleGrant.deleteMany({ where: { id: { in: lapsed.map((grant) => grant.id) } } });
    if (reverted > 0) log.info("timed roles taken back", { lapsed: lapsed.length, reverted });
    return reverted;
}

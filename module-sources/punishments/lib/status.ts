/**
 * When a punishment is over.
 *
 * `active` is a stored column and the only thing that ever wrote it was an
 * admin pressing Revoke. `expiresAt` was offered by the create form, accepted
 * by the API, editable afterwards and printed in the table, and nothing on the
 * platform ever compared it to the clock: a seven-day ban still read "Active"
 * in the admin table a year later, and still answered `active: true` to the
 * game server polling this module.
 *
 * Expiry is derived here rather than swept by a cron job. It is then true the
 * moment the clock passes it, it cannot leave a stale row behind, and a
 * temporary ban ends on a site whose scheduler is not running. The stored
 * column keeps its own meaning: `active: false` is "an admin revoked this",
 * which outlives the expiry date and is not the same fact.
 */

export type PunishmentStatus = "active" | "expired" | "revoked";

export interface PunishmentClock {
    active: boolean;
    expiresAt: Date | string | null;
}

/** The three states a row can be in, in the order they take precedence. */
export function punishmentStatus(p: PunishmentClock, now: number = Date.now()): PunishmentStatus {
    if (!p.active) return "revoked";
    if (p.expiresAt !== null && new Date(p.expiresAt).getTime() <= now) return "expired";
    return "active";
}

/**
 * The same three states as a Prisma filter, so a page of results is a page of
 * that status rather than a page of everything with the others struck out.
 */
export function statusWhere(status: PunishmentStatus, now: Date = new Date()): Record<string, unknown> {
    if (status === "revoked") return { active: false };
    if (status === "expired") return { active: true, expiresAt: { lte: now } };
    return { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}

/** Whether a query string value names one of the three states. */
export function isPunishmentStatus(value: string | null): value is PunishmentStatus {
    return value === "active" || value === "expired" || value === "revoked";
}

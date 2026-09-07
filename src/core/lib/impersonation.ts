/**
 * Who an administrator may step into, decided once.
 *
 * The rules were written in `POST /api/v1/admin/impersonate/start` and
 * enforced in the `jwt` callback, because the route only authorises: the
 * client then calls `update({ impersonate: userId })` and the callback is
 * what rewrites the token. The two lists were not the same. The callback
 * checked the caller and the target's existence and stopped there, so an
 * admin who skipped the route got what the route forbids, including stepping
 * into another administrator, whose actions the audit log would then put in
 * their name.
 *
 * Import-free on purpose: the callback runs inside Auth.js and the route runs
 * in a handler, and neither should have to pull the other in to agree.
 */

/** The session doing the asking. */
export interface ImpersonationActor {
    id: string;
    role?: string;
    /** Set while a session is already speaking for somebody else. */
    originalUserId?: string;
}

/** The account being asked for, as the database returned it. */
export interface ImpersonationTarget {
    id: string;
    isBanned: boolean;
    role?: { name?: string | null } | null;
}

export type ImpersonationRefusal =
    | "not_admin"
    | "already"
    | "self"
    | "not_found"
    | "banned"
    | "admin_target";

/**
 * Why this impersonation is refused, or `null` when it is allowed.
 *
 * Ordered the way a caller learns things: what the session is before what the
 * target is, so a non-admin is told nothing about whether an account exists.
 */
export function impersonationRefusal(
    actor: ImpersonationActor,
    target: ImpersonationTarget | null,
): ImpersonationRefusal | null {
    if (actor.role !== "admin") return "not_admin";
    if (actor.originalUserId) return "already";
    if (!target) return "not_found";
    if (target.id === actor.id) return "self";
    if (target.isBanned) return "banned";
    if (target.role?.name === "admin") return "admin_target";
    return null;
}

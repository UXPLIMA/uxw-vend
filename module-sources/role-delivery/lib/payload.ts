/**
 * What a seller filled in, as this module reads it.
 *
 * The market stores the payload as JSON it never looks inside: it belongs to
 * whichever module claims the kind. So it arrives as `unknown` and is narrowed
 * here rather than trusted, because a listing written by one version of this
 * module is read by the next one.
 */

export interface WantedRole {
    roleId: string;
    days: number;
}

/** Null when the listing does not say what it is selling. */
export function readRolePayload(payload: unknown): WantedRole | null {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const { roleId, days } = payload as { roleId?: unknown; days?: unknown };
    if (typeof roleId !== "string" || roleId.trim() === "") return null;
    const asNumber = typeof days === "number" ? days : Number(days);
    if (!Number.isFinite(asNumber)) return null;
    return { roleId: roleId.trim(), days: asNumber };
}

/**
 * What LiteBans sends, and what a punishment is here.
 *
 * LiteBans is one plugin among several that ban people on a Minecraft server,
 * and each spells the same event differently: `type` is `BAN`, `TEMPBAN`,
 * `MUTE`, `KICK` or `WARN`; the end of a temporary punishment is `until` in
 * milliseconds, with `0` or `-1` meaning permanent; the staff member is
 * `banned_by_name`. None of that belongs in a module called "Punishments",
 * which is why this one exists.
 */
import { z } from "zod";

/** A LiteBans row, as its webhook sends it. */
export const liteBansReport = z.object({
    id: z.union([z.string(), z.number()]),
    type: z.string().min(1).max(32),
    uuid: z.string().max(64).optional().nullable(),
    name: z.string().min(1).max(64),
    reason: z.string().max(500).optional().nullable(),
    banned_by_name: z.string().max(64).optional().nullable(),
    /** Milliseconds since the epoch. 0 or -1 is "does not end". */
    until: z.union([z.string(), z.number()]).optional().nullable(),
    /** LiteBans keeps a row after it is lifted and flags it inactive. */
    active: z.boolean().optional(),
});

export type LiteBansReport = z.infer<typeof liteBansReport>;

function endsAt(until: string | number | null | undefined): Date | null {
    const ms = typeof until === "string" ? Number(until) : until;
    if (!ms || !Number.isFinite(ms) || ms <= 0) return null;
    return new Date(ms);
}

/** How long it runs, in the words a reader expects rather than in milliseconds. */
function duration(expires: Date | null): string {
    if (!expires) return "permanent";
    const hours = Math.max(1, Math.round((expires.getTime() - Date.now()) / 3_600_000));
    return hours >= 24 ? `${Math.round(hours / 24)}d` : `${hours}h`;
}

export function asPunishmentReport(row: LiteBansReport, userId: string | null) {
    const expires = endsAt(row.until);
    return {
        source: "minecraft-litebans",
        externalRef: String(row.id),
        userId,
        playerName: row.name,
        playerUuid: row.uuid ?? null,
        type: row.type.toLowerCase(),
        reason: row.reason ?? null,
        duration: duration(expires),
        punishedBy: row.banned_by_name ?? null,
        expiresAt: expires ? expires.toISOString() : null,
        active: row.active ?? true,
    };
}

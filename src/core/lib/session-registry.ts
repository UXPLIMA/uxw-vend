/**
 * Where a signed-in device is written down.
 *
 * Under the JWT strategy the cookie is the session, so the only server-side
 * trace of a device is a `UserSession` row keyed by the `tokenId` claim the
 * token carries. Five places read that table: the profile's device list, the
 * two revoke endpoints, the `jwt` callback's revocation check, and the staff
 * module's "who is online". Nothing wrote to it. The row was never created, so
 * the list was empty for everyone, both revoke buttons updated zero rows, and
 * `isRevoked` could not become true no matter what a user clicked.
 *
 * Both calls here are best-effort on purpose. A device record is not what the
 * user asked for when they signed in, and refusing the sign-in because the
 * write failed would turn a degraded feature into an outage. A failed write is
 * logged as an error rather than a warning, because the user walks away
 * holding a session that "sign out everywhere" cannot reach.
 */
import { prisma } from "./db";
import { log, errorText } from "./logger";

export interface SignInRecord {
    /** The `tokenId` claim in the JWT; the key every revocation check uses. */
    tokenId: string;
    userId: string;
    /** When the token stops being accepted, so the row can be pruned with it. */
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
}

/**
 * Record a device against a sign-in.
 *
 * `deviceInfo` is deliberately left unset: the sessions screen renders it
 * verbatim when present, so a label written on the server would arrive in one
 * language on a screen that has two. The client derives a label from the user
 * agent through its own translations.
 */
export async function recordSignIn(record: SignInRecord): Promise<void> {
    try {
        await prisma.userSession.create({
            data: {
                tokenId: record.tokenId,
                userId: record.userId,
                expiresAt: record.expiresAt,
                ipAddress: record.ipAddress,
                userAgent: record.userAgent,
            },
        });
    } catch (err) {
        log.error("[sessions] could not record a signed-in device", { error: errorText(err) });
    }
}

/**
 * Move a session's `lastActiveAt` to now.
 *
 * `updateMany` rather than `update` because a token minted before this file
 * existed has no row, and that is not a failure: it must not throw and it must
 * not be logged on every request for the life of that cookie.
 */
export async function touchSession(tokenId: string, at: Date = new Date()): Promise<void> {
    try {
        await prisma.userSession.updateMany({
            where: { tokenId },
            data: { lastActiveAt: at },
        });
    } catch (err) {
        log.error("[sessions] could not refresh a device's last activity", { error: errorText(err) });
    }
}

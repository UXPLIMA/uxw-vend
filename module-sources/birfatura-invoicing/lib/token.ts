/**
 * The one string between the open internet and every customer's billing
 * details.
 *
 * A pulling integrator signs in with a shared secret in a header. There is no
 * session behind it and no second factor, so the comparison is the whole of
 * the security, and two ways of writing it are wrong in ways that do not show
 * up in testing:
 *
 * - "no secret configured" has to mean nobody gets in. Read the other way it
 *   means a fresh install publishes its customer list;
 * - `===` stops at the first byte that differs, so how long it takes says how
 *   much of the secret was right, and the secret comes out a byte at a time.
 */
import crypto from "crypto";

export function tokenAccepted(sent: string | null | undefined, configured: string): boolean {
    const secret = configured.trim();
    // Nothing set up yet. Anything else here is an open door.
    if (secret === "") return false;

    const offered = (sent ?? "").trim();
    if (offered === "") return false;

    // Hash both first: `timingSafeEqual` throws on a length mismatch, and
    // catching that is itself a length oracle. Digests are always the same
    // size, so the comparison below is over equal buffers whatever arrived.
    const a = crypto.createHash("sha256").update(offered).digest();
    const b = crypto.createHash("sha256").update(secret).digest();
    return crypto.timingSafeEqual(a, b);
}

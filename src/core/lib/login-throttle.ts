/**
 * A ceiling on guessing, counted per address rather than per account.
 *
 * The account lockout in `account-lockout.ts` answers "is somebody guessing
 * this person's password". It cannot answer the commoner question, which is
 * "is somebody trying one password against every account here" - each account
 * sees a single failure and no threshold is ever reached. Measured against a
 * production build: forty sign-in attempts from one address against forty
 * accounts, all forty served, nothing counted.
 *
 * Only a failure is counted. The address is shared by everyone behind one
 * office, school, household or carrier NAT, and a ceiling that also counted
 * successful sign-ins would lock those people out of a site with nothing wrong
 * with it. Guessing is what is being bounded, and a guess that was right is
 * not guessing.
 *
 * An address the deployment cannot name is not counted at all. Behind a proxy
 * that strips the forwarded header every caller looks identical, and putting
 * them in one bucket would let a single guesser lock out the whole site: a
 * worse failure than the one being prevented.
 *
 * How much the address is worth depends on the deployment. Without
 * TRUSTED_PROXY_IPS the caller writes their own forwarded header and buys a
 * fresh budget by changing it - already true of every limit here, and warned
 * about at boot. This raises the cost of the attack that actually arrives.
 */
import { rateLimit, rateLimitPeek, forgetMemoryRateLimits } from "./rate-limit";

/** Wrong passwords one address may produce before it is refused outright. */
export const LOGIN_FAILURES_PER_ADDRESS = 15;

/** How long a run of failures is remembered. */
const LOGIN_FAILURE_WINDOW_MS = 15 * 60_000;

const CONFIG = {
    maxRequests: LOGIN_FAILURES_PER_ADDRESS,
    windowMs: LOGIN_FAILURE_WINDOW_MS,
};

function bucket(address: string): string | null {
    const trimmed = address.trim();
    return trimmed === "" ? null : `login-fail:${trimmed}`;
}

/** True while this address may attempt a sign-in. Spends nothing. */
export async function loginAllowedFrom(address: string): Promise<boolean> {
    const key = bucket(address);
    if (!key) return true;
    const { success } = await rateLimitPeek(key, CONFIG);
    return success;
}

/** Count one wrong password against this address. */
export async function noteFailedLoginFrom(address: string): Promise<void> {
    const key = bucket(address);
    if (!key) return;
    await rateLimit(key, CONFIG);
}

/** Test seam: the memory backend is process-global and outlives one test. */
export function forgetLoginFailures(): void {
    forgetMemoryRateLimits();
}

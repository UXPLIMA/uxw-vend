/**
 * What a refused sign in was refused for, as the browser can read it.
 *
 * Auth.js hands a browser the *type* of the error a sign in ended with, never
 * its message: anything thrown inside `authorize` that is not an `AuthError`
 * is wrapped in a `CallbackRouteError` first, and the message stays in the
 * server log. The one thing that does travel is the `code` of a
 * `CredentialsSignin`, which `@auth/core` copies into the redirect URL and
 * `next-auth/react` returns alongside the error.
 *
 * So a refusal is named here, once, and both sides of the wire read the same
 * list: the server throws with one of these codes and the screen turns it
 * into a sentence. The codes travel in a URL a signed out visitor can see, so
 * they say only what the visitor is about to be told anyway.
 *
 * Kept free of imports on purpose. The sign in screen is a client component
 * and `next-auth` has no business in its bundle for the sake of five strings.
 */

/** Codes the server may attach to a refusal. */
export const REFUSAL_CODE = {
    /** Auth.js's own code when `authorize` returns null. */
    badCredentials: "credentials",
    accountLocked: "account_locked",
    /** Too much guessing from this address, whoever it was aimed at. */
    tooManyAttempts: "too_many_attempts",
    banned: "banned",
    twoFactorRequired: "two_factor_required",
    invalidTwoFactor: "invalid_two_factor",
    /** Prefix. A challenge module names its own reason after the colon. */
    challengeFailed: "challenge_failed",
} as const;

export type Refusal =
    | { kind: "bad-credentials" }
    | { kind: "account-locked" }
    | { kind: "too-many-attempts" }
    | { kind: "banned" }
    | { kind: "two-factor-required" }
    | { kind: "invalid-two-factor" }
    | { kind: "challenge-failed"; code: string }
    | { kind: "unknown" };

/** The part of `signIn`'s answer that says a sign in did not happen. */
export interface RefusalResult {
    error?: string | null;
    code?: string | null;
}

/**
 * Read a refusal, or `unknown` when there is nothing to read. `unknown` is
 * the honest answer for a server that failed rather than a visitor who
 * mistyped, and the screen must not offer it as a password problem.
 */
export function readRefusal(result: RefusalResult): Refusal {
    const code = typeof result.code === "string" ? result.code : "";

    if (code === REFUSAL_CODE.badCredentials) return { kind: "bad-credentials" };
    if (code === REFUSAL_CODE.accountLocked) return { kind: "account-locked" };
    if (code === REFUSAL_CODE.tooManyAttempts) return { kind: "too-many-attempts" };
    if (code === REFUSAL_CODE.banned) return { kind: "banned" };
    if (code === REFUSAL_CODE.twoFactorRequired) return { kind: "two-factor-required" };
    if (code === REFUSAL_CODE.invalidTwoFactor) return { kind: "invalid-two-factor" };

    if (code === REFUSAL_CODE.challengeFailed || code.startsWith(`${REFUSAL_CODE.challengeFailed}:`)) {
        return { kind: "challenge-failed", code: code.slice(REFUSAL_CODE.challengeFailed.length + 1) };
    }

    return { kind: "unknown" };
}

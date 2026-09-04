/**
 * The client-safe half of the auth challenge contract.
 *
 * The login, register and forgot-password forms are client components, so
 * anything they import is bundled for the browser - including the far side of
 * a dynamic `import()`. `runAuthChallenge` reaches the hook bus, which reaches
 * the database and the logger, which reaches `next/headers`; pulling any of
 * that into a browser bundle fails the build outright.
 *
 * So the names both halves need - the field, the action union, the parser -
 * live here, and nothing in this file may import anything that is not itself
 * safe in a browser bundle. The server half is in `auth-challenge.ts`, and
 * `tests/unit/client-bundle-safety.test.ts` keeps the two apart.
 */

export type AuthChallengeAction = "login" | "register" | "forgotPassword";

export interface AuthChallengeResult {
    ok: boolean;
    code: string | null;
}

/** What every form starts with: nothing to prove. */
export const CHALLENGE_PASSED: AuthChallengeResult = { ok: true, code: null };

/** The credential/body field the collected challenge fields travel in. */
export const CHALLENGE_FIELD = "challenge";

/** Parse what the client sent, tolerating absence and nonsense. */
export function parseChallengeFields(raw: unknown): Record<string, string> {
    let value = raw;
    if (typeof value === "string") {
        try {
            value = JSON.parse(value);
        } catch {
            return {};
        }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (typeof v === "string" && v.length <= 4096) out[k] = v;
    }
    return out;
}

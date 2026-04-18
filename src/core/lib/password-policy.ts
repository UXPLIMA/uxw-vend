/**
 * Centralised password rules shared by registration, password-change, and
 * password-reset flows. Kept in one file so bumping the minimum length or
 * the common-passwords list propagates everywhere automatically.
 *
 * Policy, in order of importance (NIST SP 800-63B style):
 *   - Length >= 10 (the primary gate; longer > complex)
 *   - <= 128 characters to bound bcrypt work
 *   - At least one uppercase + one digit (kept from the previous policy
 *     to avoid an abrupt UX change; can be relaxed later without harm)
 *   - Not in a short list of well-known / breached passwords
 *
 * An online HIBP lookup would be stronger, but adds a network dependency
 * in the hot signup path. The embedded list catches the flagrant ones
 * until we wire k-anonymity.
 */

const MIN_LENGTH = 10;
const MAX_LENGTH = 128;

// Top-tier obviously-bad passwords. Normalized to lower-case + trimmed; the
// check runs against normalizedInput, so variations like "Password1" vs
// "password1" still hit the list for the base form.
const COMMON_PASSWORDS = new Set<string>([
    "password",
    "password1",
    "password123",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty123",
    "qwertyuiop",
    "letmein",
    "letmein123",
    "admin",
    "administrator",
    "welcome",
    "welcome1",
    "iloveyou",
    "trustno1",
    "sunshine",
    "abc12345",
    "monkey123",
    "111111",
    "000000",
    "changeme",
    "passw0rd",
    "p@ssw0rd",
]);

export interface PasswordCheck {
    ok: boolean;
    reason?: "too_short" | "too_long" | "missing_upper" | "missing_digit" | "too_common";
    message?: string;
}

export function checkPasswordPolicy(input: unknown): PasswordCheck {
    if (typeof input !== "string") {
        return { ok: false, reason: "too_short", message: `Password must be at least ${MIN_LENGTH} characters` };
    }
    if (input.length < MIN_LENGTH) {
        return { ok: false, reason: "too_short", message: `Password must be at least ${MIN_LENGTH} characters` };
    }
    if (input.length > MAX_LENGTH) {
        return { ok: false, reason: "too_long", message: `Password must be at most ${MAX_LENGTH} characters` };
    }
    if (!/[A-Z]/.test(input)) {
        return { ok: false, reason: "missing_upper", message: "Password must contain at least one uppercase letter" };
    }
    if (!/[0-9]/.test(input)) {
        return { ok: false, reason: "missing_digit", message: "Password must contain at least one number" };
    }
    if (COMMON_PASSWORDS.has(input.trim().toLowerCase())) {
        return { ok: false, reason: "too_common", message: "Password is too common — pick something more unique" };
    }
    return { ok: true };
}

export const PASSWORD_POLICY = { MIN_LENGTH, MAX_LENGTH } as const;

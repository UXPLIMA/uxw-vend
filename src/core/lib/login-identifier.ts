/**
 * What the login form's first field means.
 *
 * Registration captures a username as well as an email, and both columns are
 * unique, so an account has two names an operator reasonably expects to be
 * able to sign in with. Accepting only the email left every user who
 * remembered their username locked out of an account whose password they
 * knew.
 *
 * The two are told apart by the "@": the registration schema restricts a
 * username to `[A-Za-z0-9_-]`, so a value containing one cannot be a username
 * on any account this platform created. Branching on that keeps the lookup on
 * a unique index and keeps the result deterministic, which an `OR` across both
 * columns would not be if a legacy row ever held an "@" in its username.
 *
 * Matching stays case-sensitive in both directions, exactly as the
 * email-only lookup was.
 */
export type IdentifierLookup = { email: string } | { username: string };

/**
 * Turns a submitted identifier into a Prisma `where` clause.
 *
 * Returns null for anything that cannot identify an account, so the caller
 * rejects the attempt without a database round-trip.
 */
export function identifierLookup(raw: unknown): IdentifierLookup | null {
    if (typeof raw !== "string") return null;
    // Browsers and password managers both leave stray whitespace behind.
    const value = raw.trim();
    if (value.length === 0) return null;
    return value.includes("@") ? { email: value } : { username: value };
}

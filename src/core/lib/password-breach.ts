/**
 * Optional haveibeenpwned breach check using the k-anonymity range API.
 * Only the first 5 chars of the SHA-1 digest leave the server - the
 * response is a list of suffixes and counts, and we look ours up locally.
 *
 * Gated by PASSWORD_BREACH_CHECK=1 so installs can run fully offline.
 * Fail-open on any network / timeout error so a flaky HIBP never blocks
 * legitimate sign-ups.
 *
 * This is the half of the password rules that reaches the network and node's
 * crypto, which is why it no longer sits in `password-policy.ts`: that file is
 * imported by the setup wizard in the browser, so it has to stay pure.
 */
const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";
const HIBP_TIMEOUT_MS = 1500;
const HIBP_MIN_COUNT = 1;

export interface BreachCheckResult {
    ok: boolean;
    count: number;
}

async function sha1HexUpper(input: string): Promise<string> {
    const { createHash } = await import("crypto");
    return createHash("sha1").update(input).digest("hex").toUpperCase();
}

export async function checkPasswordBreach(password: string): Promise<BreachCheckResult> {
    if (process.env.PASSWORD_BREACH_CHECK !== "1") {
        return { ok: true, count: 0 };
    }
    try {
        const hash = await sha1HexUpper(password);
        const prefix = hash.slice(0, 5);
        const suffix = hash.slice(5);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
        try {
            const res = await fetch(HIBP_RANGE_URL + prefix, {
                headers: { "Add-Padding": "true", "User-Agent": "uxwvend-password-check" },
                signal: controller.signal,
            });
            if (!res.ok) return { ok: true, count: 0 };
            const text = await res.text();
            for (const line of text.split("\n")) {
                const [lineSuffix, countStr] = line.trim().split(":");
                if (lineSuffix === suffix) {
                    const count = Number(countStr) || 0;
                    return { ok: count < HIBP_MIN_COUNT, count };
                }
            }
            return { ok: true, count: 0 };
        } finally {
            clearTimeout(timer);
        }
    } catch {
        // Fail-open on any error so a flaky HIBP can't block registration.
        return { ok: true, count: 0 };
    }
}

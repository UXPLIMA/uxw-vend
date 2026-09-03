/**
 * Steam sign-in speaks OpenID 2.0, not OAuth2.
 *
 * That is the whole reason this module ships its own provider. Auth.js's OAuth
 * pipeline hands the callback straight to `oauth4webapi` and exchanges an
 * authorization code at a token endpoint; Steam has neither a code nor a token
 * endpoint. What it has is a signed assertion in the callback query string,
 * which you hand back to Steam to be told whether it is genuine.
 *
 * Everything here is pure apart from the one `fetch` in `verifyAssertion`, and
 * that call is injectable so the verification can be tested without reaching
 * the internet.
 */

export const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";

const OPENID_NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";

/** A Steam id is a 17-digit 64-bit community id. Nothing else is accepted. */
const CLAIMED_ID = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

/**
 * The URL that starts the flow.
 *
 * `realm` is the site Steam shows the user; `returnTo` is where it sends them
 * back. Both are echoed in the assertion and re-checked on the way back, so
 * they must be built from the same canonical app URL at both ends.
 */
export function buildLoginUrl(realm: string, returnTo: string): string {
    const params = new URLSearchParams({
        "openid.ns": OPENID_NS,
        "openid.mode": "checkid_setup",
        "openid.identity": IDENTIFIER_SELECT,
        "openid.claimed_id": IDENTIFIER_SELECT,
        "openid.return_to": returnTo,
        "openid.realm": realm,
    });
    return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

export interface VerifyAssertionOptions {
    /** The exact return_to sent in `buildLoginUrl`. */
    returnTo: string;
    /** Injectable for tests. Defaults to global fetch. */
    fetchImpl?: typeof fetch;
}

/**
 * Checks an assertion and returns the Steam id it proves, or null.
 *
 * There is no state parameter to check: Steam echoes back only the `openid.*`
 * fields, so a CSRF token cannot ride along. What protects the flow instead is
 * that the assertion is worthless on its own - it authenticates a Steam id to
 * us, and the session it leads to is minted from a single-use ticket bound to
 * that id.
 */
export async function verifyAssertion(
    query: URLSearchParams,
    options: VerifyAssertionOptions,
): Promise<string | null> {
    const { returnTo, fetchImpl = fetch } = options;

    if (query.get("openid.mode") !== "id_res") return null;
    if (query.get("openid.ns") !== OPENID_NS) return null;
    if (query.get("openid.op_endpoint") !== STEAM_OPENID_ENDPOINT) return null;

    // Steam signs return_to, so a mismatch means the assertion was minted for
    // a different site and replayed at ours.
    if (query.get("openid.return_to") !== returnTo) return null;

    const claimed = query.get("openid.claimed_id") ?? "";
    const match = CLAIMED_ID.exec(claimed);
    if (!match) return null;

    // The signature itself is only checkable by Steam. Send every openid.*
    // field straight back with the mode swapped, which is what OpenID 2.0
    // calls direct verification.
    const body = new URLSearchParams();
    for (const [key, value] of query.entries()) {
        if (key.startsWith("openid.")) body.set(key, value);
    }
    body.set("openid.mode", "check_authentication");

    const response = await fetchImpl(STEAM_OPENID_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    if (!response.ok) return null;

    const text = await response.text();
    // Key-value form response. Match the whole line so a hostile
    // "is_valid:false" cannot be satisfied by a substring somewhere else.
    const isValid = text.split(/\r?\n/).some((line) => line.trim() === "is_valid:true");
    return isValid ? match[1] : null;
}

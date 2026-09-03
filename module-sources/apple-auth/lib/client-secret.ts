/**
 * Apple's client secret, which the site has to sign for itself.
 *
 * Every other provider hands out a secret string that is pasted into an
 * environment variable and left alone. Apple instead expects a short-lived
 * ES256 token signed with a key you download once as a `.p8` file, valid for
 * at most six months. Pasting a hand-generated token into the environment
 * would work until it expires, at which point sign-in breaks with no warning
 * and nothing in the panel to explain it. So the module holds the key and
 * mints the token itself.
 *
 * Node's `crypto` signs this without a JWT library: `dsaEncoding: "ieee-p1363"`
 * asks for the raw r||s pair JOSE wants, rather than the DER wrapper OpenSSL
 * produces by default.
 */
import crypto from "crypto";

/** Apple rejects anything longer. */
export const MAX_LIFETIME_SECONDS = 15777000;

export interface AppleSecretInput {
    /** The Services ID, e.g. `com.example.web`. Not the App ID. */
    clientId: string;
    /** The 10-character team identifier. */
    teamId: string;
    /** The 10-character identifier of the signing key. */
    keyId: string;
    /** Contents of the `.p8` file, PEM encoded. */
    privateKey: string;
    /** Seconds, for tests. */
    now?: number;
    lifetimeSeconds?: number;
}

const base64url = (value: Buffer | string): string =>
    Buffer.from(value).toString("base64url");

/**
 * Accepts the key however an operator managed to get it into the environment.
 *
 * A `.p8` file is multi-line PEM, and plenty of ways of setting an environment
 * variable cannot carry a newline - so `\n` written literally is the usual
 * workaround and has to work. Surrounding quotes come from the same place.
 */
export function normalisePrivateKey(raw: string): string {
    const unquoted = raw.trim().replace(/^["']|["']$/g, "");
    return unquoted.replace(/\\n/g, "\n").trim();
}

/** Signs the token Apple's token endpoint accepts in place of a secret. */
export function mintClientSecret(input: AppleSecretInput): string {
    const issuedAt = Math.floor(input.now ?? Date.now() / 1000);
    const lifetime = Math.min(input.lifetimeSeconds ?? MAX_LIFETIME_SECONDS, MAX_LIFETIME_SECONDS);

    const header = base64url(JSON.stringify({ alg: "ES256", kid: input.keyId, typ: "JWT" }));
    const payload = base64url(
        JSON.stringify({
            iss: input.teamId,
            iat: issuedAt,
            exp: issuedAt + lifetime,
            aud: "https://appleid.apple.com",
            sub: input.clientId,
        }),
    );

    const signingInput = `${header}.${payload}`;
    const key = crypto.createPrivateKey(normalisePrivateKey(input.privateKey));
    const signature = crypto.sign("sha256", Buffer.from(signingInput), {
        key,
        dsaEncoding: "ieee-p1363",
    });

    return `${signingInput}.${base64url(signature)}`;
}

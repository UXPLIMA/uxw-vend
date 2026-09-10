/**
 * Talking to the accounting service.
 *
 * It signs in with an OAuth2 password grant and then takes JSON:API bodies
 * under a company of its own, so every call needs a token and a company id.
 * The token is short lived and fetched per run rather than cached: this
 * module issues one invoice per sale, not one per request, so a cached token
 * would save nothing and add a stale-credential failure that only shows up
 * under load.
 *
 * Nothing here decides anything. What goes in the documents is decided in
 * `invoice-payload.ts`, which is where the tests are, because this half
 * cannot be exercised without a live account.
 */
import { readSettingStrings } from "@/core/sdk/server";

const HOST = "https://api.parasut.com";

export interface ProviderConfig {
    clientId: string;
    clientSecret: string;
    username: string;
    password: string;
    companyId: string;
}

const KEYS = [
    "parasut_client_id",
    "parasut_client_secret",
    "parasut_username",
    "parasut_password",
    "parasut_company_id",
] as const;

/** What an operator has set up, or null when anything is missing. */
export async function providerConfig(): Promise<ProviderConfig | null> {
    // Through the SDK rather than off the row. The credentials among these
    // keys are encrypted at rest, so a direct read returns ciphertext and
    // the provider rejects it as if the operator had mistyped the key.
    const values = await readSettingStrings([...KEYS]);
    const read = (key: string) => values[key] ?? "";

    const config = {
        clientId: read("parasut_client_id"),
        clientSecret: read("parasut_client_secret"),
        username: read("parasut_username"),
        password: read("parasut_password"),
        companyId: read("parasut_company_id"),
    };
    return Object.values(config).every((value) => value !== "") ? config : null;
}

export async function isConfigured(): Promise<boolean> {
    return (await providerConfig()) !== null;
}

/** What went wrong, in words an operator can act on. */
export class ProviderError extends Error {}

async function accessToken(config: ProviderConfig): Promise<string> {
    const res = await fetch(`${HOST}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            grant_type: "password",
            client_id: config.clientId,
            client_secret: config.clientSecret,
            username: config.username,
            password: config.password,
            redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
        }),
    });
    if (!res.ok) {
        // Never the body: it is a sign-in response and the request carried a
        // password.
        throw new ProviderError(`Sign-in to the accounting service was refused (${res.status})`);
    }
    const body = (await res.json()) as { access_token?: unknown };
    if (typeof body.access_token !== "string") {
        throw new ProviderError("The accounting service answered a sign-in with no token");
    }
    return body.access_token;
}

/** POST one JSON:API document and answer with the row the service created. */
export async function createRecord(
    config: ProviderConfig,
    token: string,
    collection: string,
    payload: unknown,
): Promise<{ id: string; attributes: Record<string, unknown> }> {
    const res = await fetch(`${HOST}/v4/${encodeURIComponent(config.companyId)}/${collection}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        // The service reports validation failures as a list of messages, and
        // those are the whole value of the error to an operator: "tax number
        // is invalid" is actionable, "422" is not.
        const detail = await res.text().catch(() => "");
        throw new ProviderError(
            `The accounting service refused the request (${res.status})${detail ? `: ${detail.slice(0, 300)}` : ""}`,
        );
    }

    const body = (await res.json()) as { data?: { id?: unknown; attributes?: unknown } };
    const id = body.data?.id;
    if (typeof id !== "string" && typeof id !== "number") {
        throw new ProviderError("The accounting service answered without an id");
    }
    return {
        id: String(id),
        attributes: (body.data?.attributes ?? {}) as Record<string, unknown>,
    };
}

/** Sign in once, then run the calls that need the token. */
export async function withProvider<T>(
    run: (config: ProviderConfig, token: string) => Promise<T>,
): Promise<T> {
    const config = await providerConfig();
    if (!config) throw new ProviderError("The accounting service is not set up yet");
    const token = await accessToken(config);
    return run(config, token);
}

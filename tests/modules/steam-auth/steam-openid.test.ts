// @vitest-environment node
/**
 * Steam sign-in is the one flow in the platform whose first leg is not OAuth2,
 * so its assertion check is hand-written rather than delegated to Auth.js.
 * These tests pin down what that check rejects.
 *
 * The only network call - OpenID direct verification against Steam - is
 * injected, so nothing here reaches the internet.
 */
import { describe, it, expect, vi } from "vitest";
import { buildLoginUrl, verifyAssertion, STEAM_OPENID_ENDPOINT } from "@/modules/steam-auth/lib/steam-openid";

const APP_URL = "https://shop.example.com";
const RETURN_TO = `${APP_URL}/api/v1/steam-auth/callback`;
const STEAM_ID = "76561198000000001";

function assertion(overrides: Record<string, string> = {}): URLSearchParams {
    return new URLSearchParams({
        "openid.ns": "http://specs.openid.net/auth/2.0",
        "openid.mode": "id_res",
        "openid.op_endpoint": STEAM_OPENID_ENDPOINT,
        "openid.claimed_id": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
        "openid.identity": `https://steamcommunity.com/openid/id/${STEAM_ID}`,
        "openid.return_to": RETURN_TO,
        "openid.response_nonce": "2026-09-03T10:00:00Zabc",
        "openid.assoc_handle": "1234567890",
        "openid.signed": "signed,op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle",
        "openid.sig": "Zm9vYmFy",
        ...overrides,
    });
}

const valid = () => Promise.resolve(new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:true\n"));
const invalid = () => Promise.resolve(new Response("ns:http://specs.openid.net/auth/2.0\nis_valid:false\n"));

describe("buildLoginUrl", () => {
    it("asks Steam to pick the identity and to come back to us", () => {
        const url = new URL(buildLoginUrl(APP_URL, RETURN_TO));
        expect(url.origin + url.pathname).toBe(STEAM_OPENID_ENDPOINT);
        expect(url.searchParams.get("openid.mode")).toBe("checkid_setup");
        expect(url.searchParams.get("openid.realm")).toBe(APP_URL);
        expect(url.searchParams.get("openid.return_to")).toBe(RETURN_TO);
        expect(url.searchParams.get("openid.identity")).toBe(
            "http://specs.openid.net/auth/2.0/identifier_select",
        );
    });
});

describe("verifyAssertion", () => {
    it("returns the Steam id when Steam confirms the signature", async () => {
        const fetchImpl = vi.fn(valid);
        await expect(
            verifyAssertion(assertion(), { returnTo: RETURN_TO, fetchImpl: fetchImpl as unknown as typeof fetch }),
        ).resolves.toBe(STEAM_ID);
    });

    it("asks Steam to check the assertion it was actually given", async () => {
        const fetchImpl = vi.fn(valid);
        await verifyAssertion(assertion(), {
            returnTo: RETURN_TO,
            fetchImpl: fetchImpl as unknown as typeof fetch,
        });

        const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe(STEAM_OPENID_ENDPOINT);
        const body = new URLSearchParams(String(init.body));
        expect(body.get("openid.mode")).toBe("check_authentication");
        expect(body.get("openid.sig")).toBe("Zm9vYmFy");
        expect(body.get("openid.claimed_id")).toBe(`https://steamcommunity.com/openid/id/${STEAM_ID}`);
    });

    it("rejects an assertion Steam says is not valid", async () => {
        await expect(
            verifyAssertion(assertion(), {
                returnTo: RETURN_TO,
                fetchImpl: invalid as unknown as typeof fetch,
            }),
        ).resolves.toBeNull();
    });

    // The return_to is signed by Steam, so an assertion minted for another
    // site and replayed here is exactly what this check exists to stop.
    it("rejects an assertion issued for a different site", async () => {
        const fetchImpl = vi.fn(valid);
        await expect(
            verifyAssertion(assertion({ "openid.return_to": "https://evil.example/api/v1/steam-auth/callback" }), {
                returnTo: RETURN_TO,
                fetchImpl: fetchImpl as unknown as typeof fetch,
            }),
        ).resolves.toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("rejects an identity that did not come from Steam", async () => {
        const fetchImpl = vi.fn(valid);
        await expect(
            verifyAssertion(assertion({ "openid.claimed_id": `https://evil.example/openid/id/${STEAM_ID}` }), {
                returnTo: RETURN_TO,
                fetchImpl: fetchImpl as unknown as typeof fetch,
            }),
        ).resolves.toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("rejects an endorsement from an endpoint other than Steam's", async () => {
        const fetchImpl = vi.fn(valid);
        await expect(
            verifyAssertion(assertion({ "openid.op_endpoint": "https://evil.example/openid/login" }), {
                returnTo: RETURN_TO,
                fetchImpl: fetchImpl as unknown as typeof fetch,
            }),
        ).resolves.toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("rejects a claimed id that is not a 17-digit Steam id", async () => {
        const fetchImpl = vi.fn(valid);
        await expect(
            verifyAssertion(assertion({ "openid.claimed_id": "https://steamcommunity.com/openid/id/12" }), {
                returnTo: RETURN_TO,
                fetchImpl: fetchImpl as unknown as typeof fetch,
            }),
        ).resolves.toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it("rejects a cancelled sign-in", async () => {
        const fetchImpl = vi.fn(valid);
        await expect(
            verifyAssertion(assertion({ "openid.mode": "cancel" }), {
                returnTo: RETURN_TO,
                fetchImpl: fetchImpl as unknown as typeof fetch,
            }),
        ).resolves.toBeNull();
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    // "is_valid:true" has to be the whole line. A response that merely
    // mentions the string somewhere must not pass.
    it("does not accept is_valid:true as a substring", async () => {
        const sneaky = () => Promise.resolve(new Response("is_valid:false\nnote:is_valid:true was not returned\n"));
        await expect(
            verifyAssertion(assertion(), {
                returnTo: RETURN_TO,
                fetchImpl: sneaky as unknown as typeof fetch,
            }),
        ).resolves.toBeNull();
    });

    it("rejects when Steam cannot be reached cleanly", async () => {
        const down = () => Promise.resolve(new Response("gateway", { status: 502 }));
        await expect(
            verifyAssertion(assertion(), {
                returnTo: RETURN_TO,
                fetchImpl: down as unknown as typeof fetch,
            }),
        ).resolves.toBeNull();
    });
});

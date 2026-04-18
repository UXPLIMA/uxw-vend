/**
 * Unit tests for the PayPal webhook handler.
 *
 * Because we cannot hit PayPal from CI, we stub global.fetch and verify:
 *  - Dev fallback (no creds) short-circuits signature verification
 *  - Production path does the OAuth token → verify-webhook-signature dance
 *  - Verification FAILURE returns 401
 *  - OAuth token request failure surfaces as 401
 *  - PAYPAL_ENVIRONMENT toggles the API hostname (sandbox vs live)
 *  - The verify payload is constructed with all 6 required PayPal fields
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the prisma client — the handler only touches webhookLog.create.
const mockWebhookLogCreate = vi.fn();
vi.mock("@/core/lib/db", () => ({
    prisma: {
        webhookLog: {
            create: (...args: unknown[]) => mockWebhookLogCreate(...args),
        },
    },
}));

// Helper: build a Request with the 5 required PayPal transmission headers.
function mockPayPalRequest(
    body: object,
    headers: Record<string, string> = {}
): Request {
    return new Request("http://example.com/api/v1/webhook/paypal", {
        method: "POST",
        headers: {
            "paypal-transmission-id": "tx-id-123",
            "paypal-transmission-time": "2026-04-09T10:00:00Z",
            "paypal-cert-url": "https://api.paypal.com/cert",
            "paypal-auth-algo": "SHA256withRSA",
            "paypal-transmission-sig": "mock-sig-xyz",
            "content-type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
    });
}

// Helper: construct a Response-like object that satisfies the handler's usage.
function jsonResponse(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}): Response {
    const ok = init.ok ?? true;
    const status = init.status ?? (ok ? 200 : 500);
    return {
        ok,
        status,
        statusText: init.statusText ?? (ok ? "OK" : "Error"),
        json: async () => body,
    } as unknown as Response;
}

// Snapshot original env + reset module registry between tests so the
// module-level PAYPAL_BASE constant reflects the test's env vars.
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.PAYPAL_CLIENT_ID;
    delete process.env.PAYPAL_CLIENT_SECRET;
    delete process.env.PAYPAL_WEBHOOK_ID;
    delete process.env.PAYPAL_ENVIRONMENT;
});

afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
});

type HandlerModule = {
    default: (req: Request) => Promise<{ status: number; body?: unknown }>;
};

async function loadHandler(): Promise<HandlerModule["default"]> {
    const mod = (await import(
        "../../module-sources/paypal-gateway/hooks/webhook"
    )) as HandlerModule;
    return mod.default;
}

describe("paypal webhook handler: dev fallback", () => {
    it("refuses the webhook when env vars are missing and no opt-in flag", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const handler = await loadHandler();
        const req = mockPayPalRequest({
            id: "EVT-1",
            event_type: "PAYMENT.CAPTURE.COMPLETED",
            resource: { id: "CAP-1" },
        });

        const res = await handler(req);

        expect(res.status).toBe(503);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockWebhookLogCreate).not.toHaveBeenCalled();
    });

    it("accepts the webhook only when PAYPAL_ALLOW_UNVERIFIED=1 AND not prod", async () => {
        process.env.PAYPAL_ALLOW_UNVERIFIED = "1";
        (process.env as Record<string, string>).NODE_ENV = "development";

        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const handler = await loadHandler();
        const req = mockPayPalRequest({
            id: "EVT-2",
            event_type: "PAYMENT.CAPTURE.COMPLETED",
            resource: { id: "CAP-2" },
        });

        const res = await handler(req);

        expect(res.status).toBe(200);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("refuses even with opt-in flag when NODE_ENV=production", async () => {
        process.env.PAYPAL_ALLOW_UNVERIFIED = "1";
        (process.env as Record<string, string>).NODE_ENV = "production";

        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const handler = await loadHandler();
        const res = await handler(mockPayPalRequest({ id: "X" }));

        expect(res.status).toBe(503);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("paypal webhook handler: production verification path", () => {
    beforeEach(() => {
        process.env.PAYPAL_CLIENT_ID = "client-id";
        process.env.PAYPAL_CLIENT_SECRET = "client-secret";
        process.env.PAYPAL_WEBHOOK_ID = "webhook-id-abc";
    });

    it("calls OAuth then verify-webhook-signature in order on SUCCESS", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "mock-token" }))
            .mockResolvedValueOnce(jsonResponse({ verification_status: "SUCCESS" }));
        vi.stubGlobal("fetch", fetchMock);

        const handler = await loadHandler();
        const req = mockPayPalRequest({
            id: "EVT-2",
            event_type: "PAYMENT.CAPTURE.COMPLETED",
        });
        const res = await handler(req);

        expect(res.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // Call 1: OAuth
        const [oauthUrl, oauthInit] = fetchMock.mock.calls[0] as [
            string,
            RequestInit,
        ];
        expect(oauthUrl).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
        expect(oauthInit.method).toBe("POST");
        const oauthHeaders = oauthInit.headers as Record<string, string>;
        expect(oauthHeaders["Content-Type"]).toBe(
            "application/x-www-form-urlencoded"
        );
        const expectedAuth =
            "Basic " + Buffer.from("client-id:client-secret").toString("base64");
        expect(oauthHeaders.Authorization).toBe(expectedAuth);
        expect(oauthInit.body).toBe("grant_type=client_credentials");

        // Call 2: Verify signature
        const [verifyUrl, verifyInit] = fetchMock.mock.calls[1] as [
            string,
            RequestInit,
        ];
        expect(verifyUrl).toBe(
            "https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature"
        );
        expect(verifyInit.method).toBe("POST");
        const verifyHeaders = verifyInit.headers as Record<string, string>;
        expect(verifyHeaders.Authorization).toBe("Bearer mock-token");
        expect(verifyHeaders["Content-Type"]).toBe("application/json");

        // Payload must contain all 6 required fields + webhook_event
        const payload = JSON.parse(verifyInit.body as string) as Record<
            string,
            unknown
        >;
        expect(payload.transmission_id).toBe("tx-id-123");
        expect(payload.transmission_time).toBe("2026-04-09T10:00:00Z");
        expect(payload.cert_url).toBe("https://api.paypal.com/cert");
        expect(payload.auth_algo).toBe("SHA256withRSA");
        expect(payload.transmission_sig).toBe("mock-sig-xyz");
        expect(payload.webhook_id).toBe("webhook-id-abc");
        expect(payload.webhook_event).toMatchObject({
            id: "EVT-2",
            event_type: "PAYMENT.CAPTURE.COMPLETED",
        });
    });

    it("returns 401 when verification_status is FAILURE", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "mock-token" }))
            .mockResolvedValueOnce(jsonResponse({ verification_status: "FAILURE" }));
        vi.stubGlobal("fetch", fetchMock);

        const handler = await loadHandler();
        const res = await handler(
            mockPayPalRequest({ id: "EVT-3", event_type: "PAYMENT.CAPTURE.DENIED" })
        );

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid signature" });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // Should NOT log the webhook on signature failure.
        expect(mockWebhookLogCreate).not.toHaveBeenCalled();
    });

    it("returns 401 when the OAuth token endpoint errors", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse(
                    { error: "invalid_client" },
                    { ok: false, status: 401, statusText: "Unauthorized" }
                )
            );
        // Silence the expected console.error from the handler.
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        vi.stubGlobal("fetch", fetchMock);

        const handler = await loadHandler();
        const res = await handler(
            mockPayPalRequest({ id: "EVT-4", event_type: "PAYMENT.CAPTURE.COMPLETED" })
        );

        expect(res.status).toBe(401);
        expect(res.body).toEqual({ error: "Invalid signature" });
        // Handler must NOT fall through to the verify endpoint.
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(mockWebhookLogCreate).not.toHaveBeenCalled();
        errSpy.mockRestore();
    });

    it("uses the live hostname when PAYPAL_ENVIRONMENT=live", async () => {
        process.env.PAYPAL_ENVIRONMENT = "live";

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ access_token: "mock-token" }))
            .mockResolvedValueOnce(jsonResponse({ verification_status: "SUCCESS" }));
        vi.stubGlobal("fetch", fetchMock);

        // Re-import to pick up the new env (PAYPAL_BASE is module-level).
        const handler = await loadHandler();
        const res = await handler(
            mockPayPalRequest({ id: "EVT-5", event_type: "PAYMENT.CAPTURE.COMPLETED" })
        );

        expect(res.status).toBe(200);
        const [oauthUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
        const [verifyUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(oauthUrl).toBe("https://api-m.paypal.com/v1/oauth2/token");
        expect(verifyUrl).toBe(
            "https://api-m.paypal.com/v1/notifications/verify-webhook-signature"
        );
    });
});

describe("paypal webhook handler: request body handling", () => {
    it("reads the body once without re-consuming the Request stream", async () => {
        // Dev-opt-in path: ensure body.text() isn't called twice. Request.text()
        // is single-use and a double-read would throw.
        process.env.PAYPAL_ALLOW_UNVERIFIED = "1";
        (process.env as Record<string, string>).NODE_ENV = "development";

        const handler = await loadHandler();
        const req = mockPayPalRequest({
            id: "EVT-6",
            event_type: "BILLING.SUBSCRIPTION.ACTIVATED",
        });

        const res = await handler(req);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            received: true,
            event: "BILLING.SUBSCRIPTION.ACTIVATED",
        });
    });

    it("returns 400 on invalid JSON body", async () => {
        const handler = await loadHandler();
        // Bypass the helper so we can send non-JSON.
        const req = new Request("http://example.com/api/v1/webhook/paypal", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "not-json{",
        });

        const res = await handler(req);

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: "Invalid JSON" });
    });
});

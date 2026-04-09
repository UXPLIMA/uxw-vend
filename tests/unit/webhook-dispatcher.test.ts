/**
 * Integration-style unit tests for the inbound webhook dispatcher at
 * src/app/api/v1/webhook/[provider]/route.ts.
 *
 * We stub the generated ModuleWebhookReceivers registry with a fake entry
 * that loads a spy handler, then call the real POST route function and
 * assert the wiring behaviour:
 *   - Known provider → handler is invoked with the Request
 *   - Unknown provider → 404
 *   - Disabled module → 404
 *   - No-signature-verification path passes the Request straight through
 *   - Handler throw → 500
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type WebhookHandler = (req: Request) => Promise<{ status: number; body?: unknown }>;
type ReceiverEntry = {
    provider: string;
    module: string;
    signatureHeader?: string;
    secretEnv?: string;
    loader: () => Promise<{ default: WebhookHandler }>;
};

// Mutable holders so tests can swap the behaviour between cases without
// re-running vi.mock (which is hoisted and static).
const handlerSpy = vi.fn<WebhookHandler>();
const receivers: ReceiverEntry[] = [];
const moduleStatesHolder: { value: Record<string, boolean> } = { value: {} };

vi.mock("@/core/generated/module-webhooks", () => ({
    get ModuleWebhookReceivers() {
        return receivers;
    },
}));

vi.mock("@/core/lib/module-cache", () => ({
    getModuleStates: async () => moduleStatesHolder.value,
}));

// The route file imports NextRequest/NextResponse from next/server, which
// works in a Node test env because Next polyfills them on top of web Request.
import { POST, GET } from "@/app/api/v1/webhook/[provider]/route";
import { NextRequest } from "next/server";

function makeReq(provider: string, body: object = { foo: "bar" }): NextRequest {
    return new NextRequest(
        `http://example.com/api/v1/webhook/${provider}`,
        {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        }
    );
}

beforeEach(() => {
    handlerSpy.mockReset();
    receivers.length = 0;
    moduleStatesHolder.value = {};
});

describe("webhook dispatcher: POST", () => {
    it("dispatches to the handler registered for the provider", async () => {
        handlerSpy.mockResolvedValue({ status: 200, body: { received: true } });
        receivers.push({
            provider: "paypal",
            module: "paypal-gateway",
            loader: async () => ({ default: handlerSpy }),
        });

        const req = makeReq("paypal", { id: "EVT-1" });
        const res = await POST(req, {
            params: Promise.resolve({ provider: "paypal" }),
        });

        expect(handlerSpy).toHaveBeenCalledTimes(1);
        // Handler receives the exact same Request object (no verification rewrap
        // path because no signatureHeader/secretEnv were configured).
        const [passedReq] = handlerSpy.mock.calls[0];
        expect(passedReq).toBe(req);

        expect(res.status).toBe(200);
        const json = (await res.json()) as { received: boolean };
        expect(json.received).toBe(true);
    });

    it("returns 404 for an unknown provider", async () => {
        const req = makeReq("ghost");
        const res = await POST(req, {
            params: Promise.resolve({ provider: "ghost" }),
        });

        expect(res.status).toBe(404);
        const json = (await res.json()) as { error: string };
        expect(json.error).toBe("Unknown webhook provider");
        expect(handlerSpy).not.toHaveBeenCalled();
    });

    it("returns 404 when the contributing module is disabled", async () => {
        receivers.push({
            provider: "paypal",
            module: "paypal-gateway",
            loader: async () => ({ default: handlerSpy }),
        });
        moduleStatesHolder.value = { "paypal-gateway": false };

        const req = makeReq("paypal");
        const res = await POST(req, {
            params: Promise.resolve({ provider: "paypal" }),
        });

        expect(res.status).toBe(404);
        const json = (await res.json()) as { error: string };
        expect(json.error).toBe("Module disabled");
        expect(handlerSpy).not.toHaveBeenCalled();
    });

    it("returns 500 when the handler throws", async () => {
        handlerSpy.mockRejectedValue(new Error("boom"));
        receivers.push({
            provider: "paypal",
            module: "paypal-gateway",
            loader: async () => ({ default: handlerSpy }),
        });
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const req = makeReq("paypal");
        const res = await POST(req, {
            params: Promise.resolve({ provider: "paypal" }),
        });

        expect(res.status).toBe(500);
        const json = (await res.json()) as { error: string };
        expect(json.error).toBe("Webhook handler failed");
        errSpy.mockRestore();
    });
});

describe("webhook dispatcher: GET health check", () => {
    it("returns 200 { ok: true, provider } for a known provider", async () => {
        receivers.push({
            provider: "paypal",
            module: "paypal-gateway",
            loader: async () => ({ default: handlerSpy }),
        });
        const req = new NextRequest("http://example.com/api/v1/webhook/paypal");
        const res = await GET(req, {
            params: Promise.resolve({ provider: "paypal" }),
        });
        expect(res.status).toBe(200);
        const json = (await res.json()) as { ok: boolean; provider: string };
        expect(json).toEqual({ ok: true, provider: "paypal" });
    });

    it("returns 404 for an unknown provider", async () => {
        const req = new NextRequest("http://example.com/api/v1/webhook/ghost");
        const res = await GET(req, {
            params: Promise.resolve({ provider: "ghost" }),
        });
        expect(res.status).toBe(404);
    });
});

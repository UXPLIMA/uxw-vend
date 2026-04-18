import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { checkCsrf } from "@/core/lib/csrf";

function makeRequest(method: string, headers: Record<string, string> = {}, url = "https://site.example.com/api/v1/foo"): NextRequest {
    return new NextRequest(new URL(url), {
        method,
        headers: new Headers(headers),
    });
}

describe("checkCsrf", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        delete process.env.AUTH_URL;
        delete process.env.NEXTAUTH_URL;
        delete process.env.NEXT_PUBLIC_APP_URL;
        delete process.env.CSRF_ALLOWED_ORIGINS;
        delete process.env.CSRF_INTERNAL_SECRET;
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it("allows safe methods without checking origin", () => {
        expect(checkCsrf(makeRequest("GET")).ok).toBe(true);
        expect(checkCsrf(makeRequest("HEAD")).ok).toBe(true);
        expect(checkCsrf(makeRequest("OPTIONS")).ok).toBe(true);
    });

    it("allows state-changing requests from the same origin", () => {
        const req = makeRequest("POST", { origin: "https://site.example.com" });
        expect(checkCsrf(req).ok).toBe(true);
    });

    it("rejects state-changing requests from a different origin", () => {
        const req = makeRequest("POST", { origin: "https://attacker.example.com" });
        const result = checkCsrf(req);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe("origin_mismatch");
    });

    it("rejects when both origin and referer are missing", () => {
        const req = makeRequest("POST");
        const result = checkCsrf(req);
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toBe("origin_missing");
    });

    it("falls back to referer when origin is absent", () => {
        const req = makeRequest("POST", { referer: "https://site.example.com/admin/modules" });
        expect(checkCsrf(req).ok).toBe(true);
    });

    it("honors AUTH_URL as an allowed origin", () => {
        process.env.AUTH_URL = "https://site.example.com";
        const req = makeRequest("POST", { origin: "https://site.example.com" });
        expect(checkCsrf(req).ok).toBe(true);
    });

    it("honors CSRF_ALLOWED_ORIGINS extras", () => {
        process.env.CSRF_ALLOWED_ORIGINS = "https://staging.example.com,https://another.example.com";
        const req = makeRequest("POST", { origin: "https://staging.example.com" });
        expect(checkCsrf(req).ok).toBe(true);
    });

    it("honors internal secret for server-to-server calls", () => {
        process.env.CSRF_INTERNAL_SECRET = "s3cret";
        const req = makeRequest("POST", { "x-internal-request": "s3cret" });
        expect(checkCsrf(req).ok).toBe(true);
    });

    it("ignores empty internal secret", () => {
        process.env.CSRF_INTERNAL_SECRET = "";
        const req = makeRequest("POST", { "x-internal-request": "anything" });
        expect(checkCsrf(req).ok).toBe(false);
    });
});

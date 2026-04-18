import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { checkPasswordBreach } from "@/core/lib/password-policy";

const originalEnv = process.env.PASSWORD_BREACH_CHECK;

describe("checkPasswordBreach", () => {
    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.PASSWORD_BREACH_CHECK;
        } else {
            process.env.PASSWORD_BREACH_CHECK = originalEnv;
        }
        vi.unstubAllGlobals();
    });

    it("skips the check when the env flag is off", async () => {
        delete process.env.PASSWORD_BREACH_CHECK;
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        const r = await checkPasswordBreach("password123");
        expect(r.ok).toBe(true);
        expect(r.count).toBe(0);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects a password whose SHA-1 suffix appears in the HIBP response", async () => {
        process.env.PASSWORD_BREACH_CHECK = "1";

        // SHA-1 of "password" — upper-case hex.
        const hash = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8";
        const prefix = hash.slice(0, 5);
        const suffix = hash.slice(5);

        const fetchMock = vi.fn(async (url: string) => {
            expect(url).toContain(prefix);
            return {
                ok: true,
                text: async () => `${suffix}:1042\nFFFFFFFFFF:5`,
            } as Response;
        });
        vi.stubGlobal("fetch", fetchMock);

        const r = await checkPasswordBreach("password");
        expect(r.ok).toBe(false);
        expect(r.count).toBe(1042);
    });

    it("accepts a password whose suffix is absent from the response", async () => {
        process.env.PASSWORD_BREACH_CHECK = "1";

        const fetchMock = vi.fn(async () => ({
            ok: true,
            text: async () => "FFFFFFFFFF:5\n0000000000:2",
        }) as Response);
        vi.stubGlobal("fetch", fetchMock);

        const r = await checkPasswordBreach("something-unique-for-test");
        expect(r.ok).toBe(true);
    });

    it("fails open on network errors", async () => {
        process.env.PASSWORD_BREACH_CHECK = "1";
        vi.stubGlobal("fetch", () => {
            throw new Error("network unreachable");
        });

        const r = await checkPasswordBreach("anything");
        expect(r.ok).toBe(true);
    });

    it("fails open on non-2xx HIBP responses", async () => {
        process.env.PASSWORD_BREACH_CHECK = "1";
        vi.stubGlobal("fetch", async () => ({
            ok: false,
            text: async () => "",
        }) as Response);

        const r = await checkPasswordBreach("anything");
        expect(r.ok).toBe(true);
    });
});

// @vitest-environment node
import { describe, it, expect } from "vitest";
import nextConfig from "../../next.config";

/**
 * The same SVG, two ways in, one of them unprotected.
 *
 * `images` already declares the stance: an SVG through the optimizer is
 * answered with `default-src 'none'; script-src 'none'; sandbox;` and
 * `Content-Disposition: attachment`, and measured against the running server
 * that is exactly what comes back.
 *
 * An uploaded SVG has a second address, `/uploads/<name>.svg`, and there it
 * came back under the site policy, which allows `script-src 'self'
 * 'unsafe-inline'` because the app's own pages need it. Opening one directly
 * would run whatever it carries, in this origin.
 *
 * The route that reads those bytes cannot fix it: measured against a
 * production build, a file that exists under `public/uploads` is answered by
 * the static handler and the route never runs. A header rule does apply,
 * whichever handler serves them, which is the level this belongs at.
 *
 * Uploading takes an admin session, so this is hardening rather than a hole,
 * and it is the standard the config already sets one line above.
 */

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

async function rules(): Promise<HeaderRule[]> {
    const headers = nextConfig.headers;
    if (!headers) throw new Error("next.config declares no headers()");
    return (await headers()) as HeaderRule[];
}

const SANDBOXED = "default-src 'none'; script-src 'none'; sandbox;";

describe("an uploaded SVG", () => {
    it("has a rule of its own", async () => {
        const rule = (await rules()).find((r) => r.source.includes("uploads"));
        expect(rule, "no rule matches an uploaded file").toBeTruthy();
        const csp = (rule as HeaderRule).headers.find((h) => h.key === "Content-Security-Policy");
        expect(csp?.value).toBe(SANDBOXED);
    });

    it("keeps that rule after the catch-all, so it is not overwritten", async () => {
        const sources = (await rules()).map((r) => r.source);
        expect(sources.findIndex((s) => s.includes("uploads"))).toBeGreaterThan(
            sources.indexOf("/(.*)"),
        );
    });

    it("names the extension, so a photo is not sandboxed with it", async () => {
        const rule = (await rules()).find((r) => r.source.includes("uploads"));
        expect((rule as HeaderRule).source).toContain("svg");
    });
});

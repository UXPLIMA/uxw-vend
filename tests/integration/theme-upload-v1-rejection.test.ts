// @vitest-environment node
/**
 * Theme upload rejects v1 manifests with a clear v2 upgrade hint.
 *
 * Contract: src/app/api/v1/themes/upload/route.ts must refuse any theme.json
 * that lacks schemaVersion: 2. The error message must include a hint
 * pointing the author at v2 / "upgrade" so they don't try to debug
 * unrelated fields.
 *
 * Approach: build a ZIP containing a v1 theme.json (no schemaVersion) and
 * POST it through the route handler with a mocked admin session. Assert 400
 * + error mentions "v2" or "upgrade". The route uses PROJECT_ROOT to drop
 * the extracted dir under `<root>/tmp/...`; we let it use the real
 * process.cwd() and rely on the existing tmp/ directory.
 */
import { describe, it, expect, vi } from "vitest";
import AdmZip from "adm-zip";

vi.mock("@/core/lib/auth", () => ({
    auth: async () => ({ user: { id: "admin-1" } }),
}));

vi.mock("@/core/lib/permissions", () => ({
    isAdmin: async () => true,
}));

vi.mock("@/core/lib/rate-limit", () => ({
    rateLimit: async () => ({ success: true, remaining: 100, resetAt: Date.now() + 1000 }),
}));

function buildV1ThemeZip(): Buffer {
    const zip = new AdmZip();
    // v1 manifest: no schemaVersion field, has legacy `parent` and dark variants
    const v1Manifest = {
        id: "legacy-theme-v1",
        name: "Legacy Theme",
        description: "An old v1 theme",
        version: "1.0.0",
        parent: "flat",
        tokens: {
            colors: { primary: "#ff0000" },
        },
    };
    zip.addFile("theme.json", Buffer.from(JSON.stringify(v1Manifest)));
    return zip.toBuffer();
}

import { POST } from "@/app/api/v1/themes/upload/route";

describe("theme upload v1 manifest rejection", () => {
    it("rejects with 400 and a v2/upgrade hint", async () => {
        const zipBuffer = buildV1ThemeZip();

        // Build a minimal FormData containing a File entry.
        const ab = new ArrayBuffer(zipBuffer.length);
        new Uint8Array(ab).set(zipBuffer);
        const file = new File([ab], "legacy-theme.zip", { type: "application/zip" });
        const form = new FormData();
        form.append("file", file);

        const req = new Request("http://example.com/api/v1/themes/upload", {
            method: "POST",
            body: form,
        });

        const res = await POST(req as Parameters<typeof POST>[0]);

        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: string };
        expect(body.error).toMatch(/v2|upgrade/i);
    });
});

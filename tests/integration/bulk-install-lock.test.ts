// @vitest-environment node
/**
 * Bulk install: acquireInstallLock serialization.
 *
 * Contract: two concurrent install attempts MUST serialize via the
 * install-lock. The second `acquireInstallLock()` call returns null while
 * the first is held; releasing the first allows a subsequent acquire to
 * succeed.
 *
 * The advisory-lock path requires Postgres (sets up a dedicated pg pool
 * via `eval('require')("pg")`). Without DATABASE_URL pointing at a
 * reachable Postgres, the implementation catches the connection error and
 * falls back to an in-process flag — which still satisfies the
 * serialization contract for a single worker. That's what we test here so
 * the test runs in CI without a database.
 *
 * The 50-module cap (checked in bulk-install/route.ts) is tested separately
 * via a route-level assertion on the validation branch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Force the advisory-lock path to fail fast so the in-process fallback
// kicks in. Without this we'd hang waiting for a pg connection.
vi.mock("@/core/lib/db", () => ({
    prisma: {},
}));

beforeEach(() => {
    // Strip DATABASE_URL so the pg Pool throws on connect and the
    // implementation falls back to the in-process flag path.
    delete process.env.DATABASE_URL;
    vi.resetModules();
});

describe("acquireInstallLock serialization", () => {
    it("serializes a second acquire while the first is held, and re-allows after release", async () => {
        // The advisory-lock path warns when pg connection fails (expected in
        // this CI-friendly fallback test). Mute the noise.
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => { });
        const { acquireInstallLock } = await import("@/core/lib/install-lock");

        // First acquire: should return a release fn
        const release1 = await acquireInstallLock();
        expect(release1).toBeTypeOf("function");

        // Second acquire while held: should return null (contended)
        const release2 = await acquireInstallLock();
        expect(release2).toBeNull();

        // Release the first
        release1!();

        // Now a fresh acquire should succeed
        const release3 = await acquireInstallLock();
        expect(release3).toBeTypeOf("function");

        // Cleanup
        release3!();
        warnSpy.mockRestore();
    });
});

describe("bulk-install request shape", () => {
    it("rejects payloads with more than 50 modules", async () => {
        // Mock auth + permissions so we reach the validation branch
        vi.doMock("@/core/lib/auth", () => ({ auth: async () => ({ user: { id: "admin" } }) }));
        vi.doMock("@/core/lib/permissions", () => ({ isAdmin: async () => true }));
        vi.doMock("@/core/lib/install-lock", () => ({
            acquireInstallLock: async () => () => {},
            scheduleBuild: () => {},
        }));
        vi.doMock("@/core/lib/module-cache", () => ({ invalidateModuleCache: async () => {} }));
        vi.doMock("@/core/lib/db", () => ({ prisma: { moduleConfig: { upsert: async () => ({}) } } }));

        const { POST } = await import("@/app/api/v1/modules/marketplace/bulk-install/route");

        const modules = Array.from({ length: 51 }, (_, i) => ({
            id: `mod-${i}`,
            zip: `mod-${i}.zip`,
            name: `Module ${i}`,
        }));

        const { NextRequest } = await import("next/server");
        const req = new NextRequest("http://example.com/api/v1/modules/marketplace/bulk-install", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ modules }),
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: string };
        expect(body.error).toMatch(/Max 50|50 modules/i);
    });
});

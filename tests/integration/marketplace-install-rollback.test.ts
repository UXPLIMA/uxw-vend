// @vitest-environment node
/**
 * Marketplace install rollback when registry codegen fails.
 *
 * Contract: when `scripts/generate-registry.ts` throws during a marketplace
 * install, the extracted module files MUST be removed from disk so the
 * filesystem doesn't end up with an orphan module that has no DB row.
 *
 * Strategy:
 *  - Mock auth (admin session)
 *  - Mock install-lock (acquire succeeds)
 *  - Mock db/prisma (never reached if rollback works)
 *  - Mock backupBeforeModuleChange (noop)
 *  - Mock checkModuleDependencies (always ok)
 *  - Stub global.fetch to return a valid ZIP body
 *  - Mock child_process.execFileSync so scripts/generate-registry.ts throws
 *  - Use MODULES_DIR pointed at a temp dir via the route's module-internal path
 *    (we can't easily override MODULES_DIR — so we just let it use the real
 *    src/modules dir but use a randomized moduleId that won't collide and
 *    then verify the dir disappears after the call).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import AdmZip from "adm-zip";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const tempModulesDir = path.join(os.tmpdir(), `uxw-test-modules-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
const PROJECT_ROOT_STUB = path.join(os.tmpdir(), `uxw-test-root-${Date.now()}`);

vi.mock("@/core/lib/runtime-paths", () => ({
    MODULES_DIR: tempModulesDir,
    TMP_DIR: path.join(PROJECT_ROOT_STUB, "tmp"),
    BACKUPS_DIR: path.join(PROJECT_ROOT_STUB, "backups"),
    PROJECT_ROOT: PROJECT_ROOT_STUB,
}));

vi.mock("@/core/lib/auth", () => ({
    auth: async () => ({ user: { id: "admin-user-1" } }),
}));

vi.mock("@/core/lib/permissions", () => ({
    isAdmin: async () => true,
}));

vi.mock("@/core/lib/install-lock", () => ({
    acquireInstallLock: async () => () => { /* release noop */ },
    scheduleBuild: () => {},
}));

vi.mock("@/core/lib/db", () => ({
    prisma: {
        moduleConfig: {
            upsert: vi.fn(async () => ({})),
        },
    },
}));

vi.mock("@/core/lib/module-cache", () => ({
    invalidateModuleCache: async () => {},
}));

vi.mock("@/core/lib/activity-log", () => ({
    logActivity: async () => {},
}));

vi.mock("@/core/lib/module-backup", () => ({
    backupBeforeModuleChange: async () => {},
}));

vi.mock("@/core/lib/module-dependencies", () => ({
    checkModuleDependencies: async () => ({ ok: true }),
    dependencyErrorMessage: () => "ok",
}));

// child_process.execFileSync is what runs `scripts/generate-registry.ts`.
// Make it throw on the registry call so the rollback path executes.
vi.mock("child_process", async () => {
    const actual = await vi.importActual<typeof import("child_process")>("child_process");
    return {
        ...actual,
        execFileSync: vi.fn((cmd: string, args: string[]) => {
            const cmdLine = [cmd, ...(args ?? [])].join(" ");
            if (cmdLine.includes("generate-registry")) {
                throw new Error("simulated codegen failure");
            }
            // Schema merge — also a no-op, succeed silently
            return Buffer.from("");
        }),
    };
});

// ---------------------------------------------------------------------------
// Build a minimal valid module ZIP buffer.
// ---------------------------------------------------------------------------

function buildModuleZip(moduleId: string): Buffer {
    const zip = new AdmZip();
    const manifest = {
        id: moduleId,
        name: "Test Module",
        description: "Test module for rollback test",
        version: "1.0.0",
    };
    zip.addFile("module.json", Buffer.from(JSON.stringify(manifest)));
    return zip.toBuffer();
}

// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";

beforeEach(async () => {
    await fs.mkdir(tempModulesDir, { recursive: true });
});

afterEach(async () => {
    await fs.rm(tempModulesDir, { recursive: true, force: true }).catch(() => {});
});

describe("marketplace install rollback (registry codegen failure)", () => {
    it("removes the extracted module directory and returns 500 when generate-registry throws", async () => {
        const moduleId = "rollback-test-" + Math.random().toString(36).slice(2, 8);
        const zipBuffer = buildModuleZip(moduleId);

        // Stub fetch so the route's GET of the marketplace ZIP returns our buffer.
        // Allocate a fresh ArrayBuffer so the view boundaries are exact.
        const ab = new ArrayBuffer(zipBuffer.length);
        new Uint8Array(ab).set(zipBuffer);
        const fetchMock = vi.fn(async () => ({
            ok: true,
            headers: new Headers({ "content-length": String(zipBuffer.length) }),
            arrayBuffer: async () => ab,
        } as unknown as Response));
        vi.stubGlobal("fetch", fetchMock);

        const { POST } = await import("@/app/api/v1/modules/marketplace/install/route");

        const req = new NextRequest("http://example.com/api/v1/modules/marketplace/install", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ moduleId, zipFile: `${moduleId}.zip` }),
        });

        const res = await POST(req);
        const body = (await res.json()) as { error: string };
        expect(res.status).toBe(500);
        expect(body.error).toMatch(/Registry generation failed|rolled back/i);

        // Verify the extracted directory is gone.
        const targetDir = path.join(tempModulesDir, moduleId);
        const dirExists = await fs.access(targetDir).then(() => true).catch(() => false);
        expect(dirExists).toBe(false);

        vi.unstubAllGlobals();
    });
});

// @vitest-environment node
/**
 * scripts/merge-schemas.ts must warn when a module schema redeclares a core
 * model name (e.g. `User`, `Role`). Without this warning, a module author
 * who tries to extend `User` by redeclaring it gets the field SILENTLY
 * dropped — the merger keeps only the core copy.
 *
 * The script is a runnable side-effect script (no exported function), so we
 * invoke it as a child process pointing at a throw-away temp project root
 * that contains:
 *   - prisma/schema.core.prisma (minimal core schema with `User`)
 *   - src/modules/<id>/schema.prisma (redeclares `model User`)
 *
 * The warning fires BEFORE `prisma generate` is invoked, so even if the
 * post-merge `npx prisma generate` step fails in the temp project (no real
 * DB, no node_modules), the warning is still emitted on stderr and captured
 * by execFileSync's stderr buffer in the catch block.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

const PROJECT_ROOT = path.resolve(__dirname, "../../");
const SCRIPT_PATH = path.join(PROJECT_ROOT, "scripts/merge-schemas.ts");

let tmpRoot: string;

beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uxw-merge-test-"));

    // Core schema with a User model.
    fs.mkdirSync(path.join(tmpRoot, "prisma"), { recursive: true });
    fs.writeFileSync(
        path.join(tmpRoot, "prisma/schema.core.prisma"),
        [
            'generator client { provider = "prisma-client-js" }',
            'datasource db { provider = "postgresql"; url = env("DATABASE_URL") }',
            "",
            "model User {",
            "  id String @id",
            "  email String @unique",
            "  // @@MODULE_RELATIONS",
            "}",
            "",
        ].join("\n"),
    );

    // A module that redeclares the core `User` model.
    const modDir = path.join(tmpRoot, "src/modules/colliding-mod");
    fs.mkdirSync(modDir, { recursive: true });
    fs.writeFileSync(
        path.join(modDir, "schema.prisma"),
        [
            "model User {",
            "  id String @id",
            "  evilField String?",
            "}",
            "",
        ].join("\n"),
    );
});

afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("merge-schemas core-model collision warning", () => {
    // 30s — spawning `npx tsx scripts/merge-schemas.ts` cold can take 4-6s.
    it("emits a WARNING when a module redeclares a core model", { timeout: 30_000 }, () => {
        let stdout = "";
        let stderr = "";
        try {
            const out = execFileSync(
                "npx",
                ["tsx", SCRIPT_PATH],
                {
                    cwd: tmpRoot,
                    env: { ...process.env },
                    encoding: "utf-8",
                    stdio: "pipe",
                    timeout: 30_000,
                },
            );
            stdout = out;
        } catch (err) {
            const e = err as { stdout?: string; stderr?: string; message?: string };
            stdout = e.stdout ?? "";
            stderr = e.stderr ?? "";
            // Surface failure details if this turns into a debug session
            if (!stdout && !stderr) stderr = e.message ?? "";
        }

        const combined = stdout + stderr;
        expect(combined, JSON.stringify({ stdout, stderr })).toMatch(
            /WARNING.*colliding-mod.*redeclares.*core model.*User/i,
        );
    });
});

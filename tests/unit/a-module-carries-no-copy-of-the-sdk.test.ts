/**
 * A module does not keep its own copy of something the SDK hands it.
 *
 * two-factor-auth shipped `lib/two-factor.ts`: a complete TOTP implementation
 * with `generateSecret`, `verifyToken`, `generateQRCode` and the backup-code
 * helpers. Its own routes did not use it - they import those names from
 * `@/core/sdk/server`, which is where the real ones live. So the copy sat
 * there unreachable while core's moved on, and core's grew
 * `verifyTokenWithReplayProtection`, which the copy never had. Anyone reading
 * the module to learn how the platform does two-factor, or lifting its lib
 * into a new module, would have taken the weaker one.
 *
 * The rule is the one the SDK boundary already implies: if core exports a
 * name, that is the implementation, and a module that writes its own is
 * either duplicating work or quietly forking a security decision. Wrapping
 * one is fine - a module may export a function that calls the SDK's. What is
 * not fine is defining it from scratch, which is what a file with no import
 * of the name it exports is doing.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SDK_DIR = path.join("src", "core", "sdk");
const MODULES = "module-sources";

/** Every name a module can reach through `@/core/sdk*`. */
function sdkExports(): Set<string> {
    const names = new Set<string>();
    for (const file of fs.readdirSync(SDK_DIR)) {
        if (!file.endsWith(".ts")) continue;
        const source = fs.readFileSync(path.join(SDK_DIR, file), "utf8");
        for (const block of source.matchAll(/export\s*(?:type\s*)?\{([^}]*)\}/g)) {
            for (const raw of block[1].split(",")) {
                const name = raw.trim().split(" as ").pop()?.trim();
                if (name && name !== "type") names.add(name.replace(/^type\s+/, ""));
            }
        }
        for (const fn of source.matchAll(/export (?:async )?function (\w+)/g)) names.add(fn[1]);
    }
    return names;
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, out);
        // .d.ts files declare hook payload shapes, they implement nothing.
        else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")) out.push(full);
    }
    return out;
}

describe("a module carries no copy of the SDK", () => {
    const exported = sdkExports();

    it("knows what the SDK offers", () => {
        expect(exported.size).toBeGreaterThan(80);
        expect(exported.has("prisma")).toBe(true);
    });

    it("re-implements no name core already exports", () => {
        const forks: string[] = [];
        for (const file of walk(MODULES)) {
            const source = fs.readFileSync(file, "utf8");
            for (const fn of source.matchAll(/export (?:async )?function (\w+)/g)) {
                if (!exported.has(fn[1])) continue;
                // A wrapper around the SDK's own is the point of the SDK.
                if (new RegExp(`\\b${fn[1]}\\b[^\\n]*from "@/core/sdk`).test(source)) continue;
                if (new RegExp(`import[^;]*\\b${fn[1]}\\b[^;]*@/core/sdk`, "s").test(source)) continue;
                const line = source.slice(0, fn.index).split("\n").length;
                forks.push(`${file}:${line} ${fn[1]}`);
            }
        }
        expect(forks).toEqual([]);
    });
});

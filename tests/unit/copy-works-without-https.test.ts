import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/**
 * `navigator.clipboard` is a secure-context API.
 *
 * Blysis is self-hosted, and a fresh install is reached at
 * http://<ip>:<port> long before anyone points a domain at it. On that origin
 * `navigator.clipboard` is `undefined`, so every "Copy" button - the gift
 * code, the API key, the media URL, the referral link, the backup codes, the
 * server IP in the theme's hero - threw a TypeError and did nothing. It works
 * on the developer's localhost, which is a secure context, which is why it
 * shipped eleven times.
 *
 * `copyText` handles both origins. This keeps the raw API from coming back.
 */

const ROOT = join(__dirname, "..", "..");

function grep(pattern: string, paths: string[]): string[] {
    try {
        const out = execFileSync("grep", ["-rn", "--include=*.ts", "--include=*.tsx", pattern, ...paths], {
            cwd: ROOT,
            encoding: "utf8",
        });
        return out.split("\n").filter(Boolean);
    } catch {
        return []; // grep exits 1 when it matches nothing
    }
}

describe("copy works without https", () => {
    it("reaches the clipboard API in exactly one place", () => {
        const offenders = grep("navigator\\.clipboard", ["src", "module-sources"])
            // The helper itself, and the two doc comments that explain why it
            // exists, are allowed to name the API.
            .filter((line) => !line.startsWith("src/core/lib/copy-text.ts:"))
            .filter((line) => !/^\S+:\d+:\s*\*/.test(line))
            // src/modules is a build-time copy of module-sources; the source
            // is what a fix has to land in.
            .filter((line) => !line.startsWith("src/modules/"));
        expect(offenders).toEqual([]);
    });

    it("falls back to a selection rather than to nothing", () => {
        const helper = grep("execCommand", ["src/core/lib/copy-text.ts"]);
        expect(helper.length).toBeGreaterThan(0);
    });
});

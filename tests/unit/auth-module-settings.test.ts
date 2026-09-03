// @vitest-environment node
/**
 * Every sign-in module shipped a settings form asking the admin for a client
 * id and secret, saved them to the settings table, and reported success.
 * Nothing read them: Auth.js assembles its providers from the environment when
 * the process starts, long before that table is reachable. Six modules had a
 * form that could not work, and the secret it stored was stored for nothing.
 *
 * This is the guard. A module that contributes a sign-in provider does not
 * offer a form for its credentials.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const dir = path.join(process.cwd(), "module-sources");

interface Manifest {
    id: string;
    authProviders?: unknown[];
    adminRoutes?: Array<{ component: string }>;
}

const authModules = fs
    .readdirSync(dir)
    .filter((id) => fs.existsSync(path.join(dir, id, "module.json")))
    .map((id) => JSON.parse(fs.readFileSync(path.join(dir, id, "module.json"), "utf8")) as Manifest)
    .filter((m) => Array.isArray(m.authProviders) && m.authProviders.length > 0)
    .sort((a, b) => a.id.localeCompare(b.id));

function adminPages(manifest: Manifest): string[] {
    return (manifest.adminRoutes ?? []).map((r) =>
        fs.readFileSync(path.join(dir, manifest.id, r.component), "utf8"),
    );
}

describe("sign-in modules", () => {
    it("finds the shipped sign-in modules", () => {
        expect(authModules.length).toBeGreaterThan(0);
    });

    it.each(authModules.map((m) => m.id))("%s does not offer a form for its credentials", (id) => {
        const manifest = authModules.find((m) => m.id === id)!;
        for (const source of adminPages(manifest)) {
            expect(source).not.toContain("SettingsForm");
        }
    });

    it.each(authModules.map((m) => m.id))("%s shows the provider setup panel instead", (id) => {
        const manifest = authModules.find((m) => m.id === id)!;
        const pages = adminPages(manifest);
        expect(pages.length).toBeGreaterThan(0);
        expect(pages.some((source) => source.includes("AuthProviderSetup"))).toBe(true);
    });
});

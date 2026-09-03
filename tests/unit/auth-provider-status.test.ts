// @vitest-environment node
/**
 * The admin endpoint that answers "I installed a login module, why is there no
 * button?".
 *
 * A provider that is installed but unconfigured contributes nothing and says
 * nothing, which is correct behaviour and a terrible experience. These tests
 * pin down what the endpoint reports, and that it never reports a credential.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const declarations: Array<Record<string, unknown>> = [];

vi.mock("@/core/generated/module-auth-providers", () => ({
    get ModuleAuthProviders() {
        return declarations;
    },
}));

const isAdmin = vi.fn(async (_userId: string) => true);
vi.mock("@/core/lib/permissions", () => ({ isAdmin: (userId: string) => isAdmin(userId) }));

const auth = vi.fn(async () => ({ user: { id: "admin-1" } }) as unknown);
vi.mock("@/core/lib/auth", () => ({ auth: () => auth() }));

vi.mock("@/core/lib/app-url", () => ({ resolveAppUrl: () => "https://shop.example.com" }));

const { GET } = await import("@/app/api/v1/auth-providers/status/route");

interface Row {
    id: string;
    module: string;
    envVars: string[];
    missing: string[];
    configured: boolean;
    callbackUrl: string | null;
}

async function rows(): Promise<Row[]> {
    const response = await GET();
    const body = (await response.json()) as { providers: Row[] };
    return body.providers;
}

beforeEach(() => {
    declarations.length = 0;
    isAdmin.mockResolvedValue(true);
    auth.mockResolvedValue({ user: { id: "admin-1" } });
    delete process.env.AUTH_DEMO_ID;
    delete process.env.AUTH_DEMO_SECRET;
    delete process.env.AUTH_DEMO_KEY;
});

describe("GET /api/v1/auth-providers/status", () => {
    it("turns a built-in provider away until both its variables are set", async () => {
        declarations.push({
            id: "demo",
            envIdVar: "AUTH_DEMO_ID",
            envSecretVar: "AUTH_DEMO_SECRET",
            module: "demo-auth",
        });

        expect((await rows())[0]).toMatchObject({
            configured: false,
            envVars: ["AUTH_DEMO_ID", "AUTH_DEMO_SECRET"],
            missing: ["AUTH_DEMO_ID", "AUTH_DEMO_SECRET"],
        });

        process.env.AUTH_DEMO_ID = "id";
        expect((await rows())[0]).toMatchObject({ configured: false, missing: ["AUTH_DEMO_SECRET"] });

        process.env.AUTH_DEMO_SECRET = "secret";
        expect((await rows())[0]).toMatchObject({ configured: true, missing: [] });
    });

    it("gives a built-in provider the Auth.js redirect URL to register", async () => {
        declarations.push({
            id: "demo",
            envIdVar: "AUTH_DEMO_ID",
            envSecretVar: "AUTH_DEMO_SECRET",
            module: "demo-auth",
        });
        expect((await rows())[0].callbackUrl).toBe("https://shop.example.com/api/auth/callback/demo");
    });

    // A module that builds its own provider decides where its flow returns to,
    // so quoting the Auth.js URL at the admin would be a wrong answer, not a
    // missing one.
    it("offers no redirect URL for a module-supplied provider", async () => {
        declarations.push({
            id: "demo",
            factory: "auth/demo.ts",
            envVars: ["AUTH_DEMO_KEY"],
            module: "demo-auth",
        });
        const [row] = await rows();
        expect(row.callbackUrl).toBeNull();
        expect(row.envVars).toEqual(["AUTH_DEMO_KEY"]);
    });

    it("shows the standard callback URL for a module-built provider that says it uses one", async () => {
        // Battle.net, Epic Games and Kick are ordinary OAuth providers that
        // need a third setting, so they are built by their module and still
        // come back through Auth.js's own callback.
        declarations.push({
            id: "demo",
            factory: "auth/demo.ts",
            standardCallback: true,
            envVars: ["AUTH_DEMO_KEY"],
            module: "demo-auth",
        });
        const [row] = await rows();
        expect(row.callbackUrl).toBe("https://shop.example.com/api/auth/callback/demo");
    });

    it("reports whether a variable is set, never what it holds", async () => {
        process.env.AUTH_DEMO_SECRET = "super-secret-value";
        declarations.push({
            id: "demo",
            envIdVar: "AUTH_DEMO_ID",
            envSecretVar: "AUTH_DEMO_SECRET",
            module: "demo-auth",
        });
        const response = await GET();
        expect(await response.text()).not.toContain("super-secret-value");
    });

    it("answers nothing to a signed-out caller", async () => {
        auth.mockResolvedValue(null);
        expect((await GET()).status).toBe(401);
    });

    it("answers nothing to a signed-in non-admin", async () => {
        isAdmin.mockResolvedValue(false);
        expect((await GET()).status).toBe(403);
    });

    it("returns an empty list when no module contributes a provider", async () => {
        await expect(rows()).resolves.toEqual([]);
    });
});

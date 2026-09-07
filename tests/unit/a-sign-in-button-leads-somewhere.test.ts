// @vitest-environment node
/**
 * The login page offers the providers that can actually sign somebody in.
 *
 * A provider arrives as a module, and installing one puts its button on the
 * login page. Whether it *works* is a different question: Auth.js builds its
 * configuration synchronously at module load, so a provider whose credentials
 * are not in the environment is never built at all. The page did not know
 * that. On a site with the provider modules installed - which is what the
 * installer does - the login page showed twenty-four buttons, and every one of
 * them led to an error page, because not one had credentials.
 *
 * So "configured" gets one definition, used by the resolver that builds the
 * providers and by the endpoint the page asks. Two kinds of provider have two
 * shapes of that question: one declares the environment variables it needs,
 * the other takes the id and secret pair next-auth's own providers take.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { configuredProviderIds, type DeclaredAuthProvider } from "@/core/lib/auth-providers";

const builtIn = (id: string): DeclaredAuthProvider => ({
    id,
    module: `${id}-auth`,
    envIdVar: `${id.toUpperCase()}_CLIENT_ID`,
    envSecretVar: `${id.toUpperCase()}_CLIENT_SECRET`,
});

/** A provider the module builds itself; `factory` names the builder. */
const custom = (id: string, envVars: string[]): DeclaredAuthProvider => ({
    id,
    module: `${id}-auth`,
    factory: `${id}Provider`,
    envVars,
});

describe("which providers a site can actually offer", () => {
    it("names one whose id and secret are both set", () => {
        const env = { GITHUB_CLIENT_ID: "abc", GITHUB_CLIENT_SECRET: "shh" };
        expect(configuredProviderIds([builtIn("github")], env)).toEqual(["github"]);
    });

    it("leaves out one with half its credentials", () => {
        expect(configuredProviderIds([builtIn("github")], { GITHUB_CLIENT_ID: "abc" })).toEqual([]);
        expect(configuredProviderIds([builtIn("github")], { GITHUB_CLIENT_SECRET: "shh" })).toEqual([]);
    });

    it("leaves out one with an empty string, which is how an unset .env line reads", () => {
        expect(configuredProviderIds([builtIn("x")], { X_CLIENT_ID: "", X_CLIENT_SECRET: "" })).toEqual([]);
    });

    it("names a module-built provider when every variable it asked for is there", () => {
        const declared = custom("steam", ["STEAM_API_KEY"]);
        expect(configuredProviderIds([declared], { STEAM_API_KEY: "key" })).toEqual(["steam"]);
        expect(configuredProviderIds([declared], {})).toEqual([]);
    });

    it("leaves out a module-built provider that asked for nothing", () => {
        // A declaration with no variables cannot be told apart from an
        // unconfigured one, and treating it as ready puts a broken button on
        // the page. The resolver has always read it this way.
        expect(configuredProviderIds([custom("odd", [])], {})).toEqual([]);
    });

    it("keeps the order the modules were declared in, so the page is stable", () => {
        const env = {
            GITHUB_CLIENT_ID: "a", GITHUB_CLIENT_SECRET: "b",
            DISCORD_CLIENT_ID: "c", DISCORD_CLIENT_SECRET: "d",
        };
        expect(configuredProviderIds([builtIn("github"), builtIn("discord")], env)).toEqual(["github", "discord"]);
    });

    it("says nothing on a site that has configured nothing", () => {
        expect(configuredProviderIds([builtIn("github"), custom("steam", ["STEAM_API_KEY"])], {})).toEqual([]);
    });
});

describe("the endpoint the login page asks", () => {
    const rateLimit = vi.fn(async () => ({ success: true }));
    let moduleStates: Record<string, boolean> = { "github-auth": true, "x-auth": true };

    beforeEach(() => {
        vi.resetModules();
        rateLimit.mockClear();
        moduleStates = { "github-auth": true, "x-auth": true };
    });

    it("answers with ids and nothing else", async () => {
        vi.doMock("@/core/lib/rate-limit", () => ({
            rateLimit: (...args: unknown[]) => rateLimit(...(args as [])),
            getClientIP: () => "203.0.113.1",
        }));
        vi.doMock("@/core/lib/module-cache", () => ({ getModuleStates: async () => moduleStates }));
        vi.doMock("@/core/generated/module-auth-declarations", () => ({
            ModuleAuthDeclarations: [
                { id: "github", module: "github-auth", envIdVar: "GITHUB_CLIENT_ID", envSecretVar: "GITHUB_CLIENT_SECRET" },
                { id: "x", module: "x-auth", envIdVar: "X_CLIENT_ID", envSecretVar: "X_CLIENT_SECRET" },
            ],
        }));
        process.env.GITHUB_CLIENT_ID = "abc";
        process.env.GITHUB_CLIENT_SECRET = "shh";
        delete process.env.X_CLIENT_ID;
        delete process.env.X_CLIENT_SECRET;

        const { GET } = await import("@/app/api/v1/auth/providers/route");
        const res = await GET(new Request("http://example.com/api/v1/auth/providers"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({ providers: ["github"] });
        // Nothing in the answer that a secret could hide in.
        expect(JSON.stringify(body)).not.toContain("shh");

        delete process.env.GITHUB_CLIENT_ID;
        delete process.env.GITHUB_CLIENT_SECRET;
    });

    it("is rate limited, because it is public and auth-adjacent", async () => {
        vi.doMock("@/core/lib/rate-limit", () => ({
            rateLimit: async () => ({ success: false }),
            getClientIP: () => "203.0.113.1",
        }));
        vi.doMock("@/core/lib/module-cache", () => ({ getModuleStates: async () => moduleStates }));
        vi.doMock("@/core/generated/module-auth-declarations", () => ({ ModuleAuthDeclarations: [] }));

        const { GET } = await import("@/app/api/v1/auth/providers/route");
        const res = await GET(new Request("http://example.com/api/v1/auth/providers"));

        expect(res.status).toBe(429);
    });

    it("does not offer a provider whose module an operator switched off", async () => {
        // Turning the module off is the switch for "not right now", and it has
        // to work even when the credentials are still in the environment.
        moduleStates = { "github-auth": false, "x-auth": true };
        vi.doMock("@/core/lib/rate-limit", () => ({
            rateLimit: async () => ({ success: true }),
            getClientIP: () => "203.0.113.1",
        }));
        vi.doMock("@/core/lib/module-cache", () => ({ getModuleStates: async () => moduleStates }));
        vi.doMock("@/core/generated/module-auth-declarations", () => ({
            ModuleAuthDeclarations: [
                { id: "github", module: "github-auth", envIdVar: "GITHUB_CLIENT_ID", envSecretVar: "GITHUB_CLIENT_SECRET" },
            ],
        }));
        process.env.GITHUB_CLIENT_ID = "abc";
        process.env.GITHUB_CLIENT_SECRET = "shh";

        const { GET } = await import("@/app/api/v1/auth/providers/route");
        const body = await (await GET(new Request("http://example.com/api/v1/auth/providers"))).json();

        expect(body).toEqual({ providers: [] });

        delete process.env.GITHUB_CLIENT_ID;
        delete process.env.GITHUB_CLIENT_SECRET;
    });
});

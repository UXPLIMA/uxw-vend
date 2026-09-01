import { describe, it, expect, vi } from "vitest";
import { resolveAuthProviders, type DeclaredAuthProvider } from "@/core/lib/auth-providers";

const discord: DeclaredAuthProvider = {
    id: "discord",
    envIdVar: "AUTH_DISCORD_ID",
    envSecretVar: "AUTH_DISCORD_SECRET",
    module: "discord-auth",
};

const google: DeclaredAuthProvider = {
    id: "google",
    envIdVar: "AUTH_GOOGLE_ID",
    envSecretVar: "AUTH_GOOGLE_SECRET",
    module: "google-auth",
};

const fullEnv = { AUTH_DISCORD_ID: "id-123", AUTH_DISCORD_SECRET: "secret-456" };

describe("resolveAuthProviders", () => {
    it("builds a provider when the module's env vars are set", () => {
        const factory = vi.fn((config: unknown) => ({ built: config }));
        const providers = resolveAuthProviders([discord], { env: fullEnv, factories: { discord: factory } });

        expect(providers).toHaveLength(1);
        expect(providers[0]).toEqual({
            built: {
                clientId: "id-123",
                clientSecret: "secret-456",
                allowDangerousEmailAccountLinking: false,
            },
        });
    });

    it("never enables dangerous account linking", () => {
        const factories = { discord: (config: unknown) => config };
        const [built] = resolveAuthProviders([discord], { env: fullEnv, factories }) as unknown as {
            allowDangerousEmailAccountLinking: boolean;
        }[];
        expect(built.allowDangerousEmailAccountLinking).toBe(false);
    });

    it("skips a provider with no configured credentials", () => {
        const factory = vi.fn();
        expect(resolveAuthProviders([discord], { env: {}, factories: { discord: factory } })).toEqual([]);
        expect(factory).not.toHaveBeenCalled();
    });

    it("skips a provider configured with an id but no secret", () => {
        const factory = vi.fn();
        const providers = resolveAuthProviders([discord], {
            env: { AUTH_DISCORD_ID: "id-123" },
            factories: { discord: factory },
        });
        expect(providers).toEqual([]);
        expect(factory).not.toHaveBeenCalled();
    });

    it("warns and continues when next-auth ships no such provider", () => {
        const warnings: string[] = [];
        const providers = resolveAuthProviders([discord], {
            env: fullEnv,
            factories: {},
            onWarn: (m) => warnings.push(m),
        });
        expect(providers).toEqual([]);
        expect(warnings.join(" ")).toContain("discord-auth");
    });

    it("ignores a non-function entry in the factory map", () => {
        const warnings: string[] = [];
        const providers = resolveAuthProviders([discord], {
            env: fullEnv,
            factories: { discord: undefined },
            onWarn: (m) => warnings.push(m),
        });
        expect(providers).toEqual([]);
        expect(warnings).toHaveLength(1);
    });

    it("keeps working providers when one of them throws while building", () => {
        const env = { ...fullEnv, AUTH_GOOGLE_ID: "g-id", AUTH_GOOGLE_SECRET: "g-secret" };
        const factories = {
            discord: () => { throw new Error("bad config"); },
            google: () => ({ id: "google" }),
        };
        const warnings: string[] = [];
        const providers = resolveAuthProviders([discord, google], { env, factories, onWarn: (m) => warnings.push(m) });
        expect(providers).toEqual([{ id: "google" }]);
        expect(warnings.join(" ")).toContain("bad config");
    });

    it("returns nothing when no module declares a provider", () => {
        expect(resolveAuthProviders([], { env: fullEnv, factories: {} })).toEqual([]);
    });
});

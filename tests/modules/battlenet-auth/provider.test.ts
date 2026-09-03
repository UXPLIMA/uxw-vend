// @vitest-environment node
/**
 * Battle.net builds its own provider for one reason: the region issuer.
 * Battle.net runs a separate OIDC issuer per region, so a client registered in
 * Europe cannot be verified against the Americas issuer, and the built-in
 * declaration shape has nowhere to put a third setting.
 */
import { describe, it, expect } from "vitest";
import battlenetProvider from "@/modules/battlenet-auth/auth/battlenet-provider";

const env = {
    AUTH_BATTLENET_ID: "id",
    AUTH_BATTLENET_SECRET: "secret",
    AUTH_BATTLENET_ISSUER: "https://eu.battle.net/oauth",
};

describe("battlenet provider", () => {
    it("passes the region issuer through", () => {
        const provider = battlenetProvider({
            env,
            allowDangerousEmailAccountLinking: false,
        }) as unknown as { id: string; options: { issuer: string } };

        expect(provider.id).toBe("battlenet");
        expect(provider.options.issuer).toBe("https://eu.battle.net/oauth");
    });

    it("tolerates a trailing slash on the issuer", () => {
        const provider = battlenetProvider({
            env: { ...env, AUTH_BATTLENET_ISSUER: "https://oauth.battle.net/" },
            allowDangerousEmailAccountLinking: false,
        }) as unknown as { options: { issuer: string } };

        expect(provider.options.issuer).toBe("https://oauth.battle.net");
    });

    // Guessing would point every sign-in at an issuer the client is not
    // registered with, and fail as an opaque OAuth error at the callback.
    it("refuses an issuer Battle.net does not serve", () => {
        expect(() =>
            battlenetProvider({
                env: { ...env, AUTH_BATTLENET_ISSUER: "https://battle.net" },
                allowDangerousEmailAccountLinking: false,
            }),
        ).toThrow(/AUTH_BATTLENET_ISSUER/);
    });

    it("leaves email account linking off", () => {
        const provider = battlenetProvider({
            env,
            allowDangerousEmailAccountLinking: false,
        }) as unknown as { options: { allowDangerousEmailAccountLinking: boolean } };

        expect(provider.options.allowDangerousEmailAccountLinking).toBe(false);
    });
});

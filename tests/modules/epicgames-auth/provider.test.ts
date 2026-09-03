// @vitest-environment node
/**
 * Epic ships no Auth.js provider, and its flow is split across two hosts: the
 * authorization screen is on epicgames.com, where the player is signed in,
 * while the token and userinfo endpoints are on the Epic Online Services API.
 */
import { describe, it, expect } from "vitest";
import epicGamesProvider from "@/modules/epicgames-auth/auth/epicgames-provider";

const provider = epicGamesProvider({
    env: { AUTH_EPICGAMES_ID: "id", AUTH_EPICGAMES_SECRET: "secret" },
    allowDangerousEmailAccountLinking: false,
});

describe("epic games provider", () => {
    it("authorizes on epicgames.com and exchanges on the EOS API", () => {
        expect(provider.id).toBe("epicgames");
        expect((provider.authorization as { url: string }).url).toBe("https://www.epicgames.com/id/authorize");
        expect(provider.token).toBe("https://api.epicgames.dev/epic/oauth/v2/token");
        expect(provider.userinfo).toBe("https://api.epicgames.dev/epic/oauth/v2/userInfo");
    });

    // Core turns a missing address into an undeliverable placeholder, so the
    // honest answer here is null rather than something invented.
    it("reports no email rather than inventing one", () => {
        expect(provider.profile!({ sub: "epic-1", display_name: "Thrall" }, {})).toMatchObject({
            id: "epic-1",
            name: "Thrall",
            email: null,
        });
    });

    it("falls back to the account id when there is no display name", () => {
        expect(provider.profile!({ sub: "epic-1" }, {})).toMatchObject({ name: "epic-1" });
    });

    it("leaves email account linking off", () => {
        expect(provider.allowDangerousEmailAccountLinking).toBe(false);
    });
});

// @vitest-environment node
/**
 * Kick speaks OAuth 2.1, which makes PKCE mandatory and rejects a token
 * request authenticated through the Authorization header, and its user
 * endpoint answers with a one-element list rather than an object.
 */
import { describe, it, expect } from "vitest";
import kickProvider from "@/modules/kick-auth/auth/kick-provider";

const provider = kickProvider({
    env: { AUTH_KICK_ID: "id", AUTH_KICK_SECRET: "secret" },
    allowDangerousEmailAccountLinking: false,
});

describe("kick provider", () => {
    it("meets Kick's OAuth 2.1 requirements", () => {
        expect(provider.checks).toContain("pkce");
        expect(provider.client?.token_endpoint_auth_method).toBe("client_secret_post");
    });

    it("unwraps the one-element user list", () => {
        expect(
            provider.profile!(
                {
                    data: [
                        {
                            user_id: 42,
                            name: "streamer",
                            email: "s@example.com",
                            profile_picture: "https://cdn/p.png",
                        },
                    ],
                },
                {},
            ),
        ).toEqual({
            id: "42",
            name: "streamer",
            email: "s@example.com",
            image: "https://cdn/p.png",
        });
    });

    it("survives an empty answer", () => {
        expect(provider.profile!({}, {})).toMatchObject({ id: "", email: null });
    });

    it("leaves email account linking off", () => {
        expect(provider.allowDangerousEmailAccountLinking).toBe(false);
    });
});

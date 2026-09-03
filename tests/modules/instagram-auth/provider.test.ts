// @vitest-environment node
/**
 * Instagram's Basic Display API - the one Auth.js's built-in provider still
 * targets - was shut down in December 2024, so this module builds the provider
 * against Instagram Login instead. The two things worth pinning down are that
 * it points at the current endpoints, and that it survives a token response
 * that is not valid OAuth 2.
 */
import { describe, it, expect } from "vitest";
import instagramProvider, { normaliseTokenResponse } from "@/modules/instagram-auth/auth/instagram-provider";

const provider = instagramProvider({
    env: { AUTH_INSTAGRAM_ID: "id", AUTH_INSTAGRAM_SECRET: "secret" },
    allowDangerousEmailAccountLinking: false,
});

describe("instagram provider", () => {
    it("uses the Instagram Login endpoints, not the retired Basic Display ones", () => {
        const authorization = provider.authorization as { url: string; params: Record<string, string> };
        expect(authorization.url).toBe("https://www.instagram.com/oauth/authorize");
        expect(authorization.params.scope).toBe("instagram_business_basic");
        expect(String(provider.userinfo)).toContain("graph.instagram.com");
    });

    it("names the account by its handle", () => {
        expect(provider.profile!({ id: "17841400000000000", username: "uxwvend" }, {})).toMatchObject({
            id: "17841400000000000",
            name: "uxwvend",
            email: null,
        });
    });

    it("leaves email account linking off", () => {
        expect(provider.allowDangerousEmailAccountLinking).toBe(false);
    });
});

describe("normaliseTokenResponse", () => {
    // Instagram answers with a list and no token_type, which oauth4webapi
    // rejects before any of our code sees it.
    it("unwraps the documented list shape and says the token is a bearer token", () => {
        expect(normaliseTokenResponse({ data: [{ access_token: "IGAA", user_id: 42 }] })).toEqual({
            token_type: "bearer",
            access_token: "IGAA",
            user_id: 42,
        });
    });

    it("accepts the flat shape too", () => {
        expect(normaliseTokenResponse({ access_token: "IGAA" })).toEqual({
            token_type: "bearer",
            access_token: "IGAA",
        });
    });

    it("does not overwrite a token_type the endpoint did send", () => {
        expect(normaliseTokenResponse({ access_token: "a", token_type: "Bearer" })).toMatchObject({
            token_type: "Bearer",
        });
    });

    it("survives a body that is not an object", () => {
        expect(normaliseTokenResponse(null)).toEqual({ token_type: "bearer" });
    });
});

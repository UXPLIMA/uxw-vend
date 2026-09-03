/**
 * The Instagram provider, built here rather than taken from Auth.js.
 *
 * Auth.js's built-in Instagram provider still points at the Basic Display API
 * (`api.instagram.com/oauth/authorize?scope=user_profile`), which Meta shut
 * down on 4 December 2024. Declaring that provider would install a sign-in
 * button that cannot work, so this module targets its replacement, Instagram
 * API with Instagram Login: the same authorization-code flow, on
 * `instagram.com` instead, with the `instagram_business_basic` scope.
 *
 * Two consequences an admin has to know about, and the settings page says both:
 * the app has to be an Instagram Login app in the Meta developer console, and
 * the account signing in has to be a professional (business or creator) one.
 *
 * The token endpoint answers with `{ data: [ { access_token, user_id } ] }` and
 * no `token_type`, which is not a valid OAuth 2 token response and is rejected
 * before it reaches any of our code. `token.conform` is Auth.js's hook for
 * exactly that: it gets the raw response and hands back a compliant one.
 */
import type { OAuthConfig } from "next-auth/providers";

/** What `graph.instagram.com/me` returns for the fields we ask for. */
export interface InstagramProfile {
    id: string;
    username?: string;
    name?: string;
    account_type?: string;
}

interface InstagramProviderConfig {
    env: Record<string, string>;
    allowDangerousEmailAccountLinking: boolean;
}

/** Both the documented and the historical token-response shapes, flattened. */
export function normaliseTokenResponse(body: unknown): Record<string, unknown> {
    const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const data = payload.data;
    const token = Array.isArray(data) && data[0] && typeof data[0] === "object"
        ? (data[0] as Record<string, unknown>)
        : payload;
    // An Instagram short-lived token is a bearer token; the endpoint just does
    // not say so, and oauth4webapi refuses a response that does not.
    return { token_type: "bearer", ...token };
}

export default function instagramProvider(
    config: InstagramProviderConfig,
): OAuthConfig<InstagramProfile> {
    return {
        id: "instagram",
        name: "Instagram",
        type: "oauth",
        authorization: {
            url: "https://www.instagram.com/oauth/authorize",
            params: { scope: "instagram_business_basic", response_type: "code" },
        },
        token: {
            url: "https://api.instagram.com/oauth/access_token",
            conform: async (response: Response) =>
                response.ok ? Response.json(normaliseTokenResponse(await response.json())) : response,
        },
        userinfo: "https://graph.instagram.com/v23.0/me?fields=id,username,name,account_type",
        client: { token_endpoint_auth_method: "client_secret_post" },
        clientId: config.env.AUTH_INSTAGRAM_ID,
        clientSecret: config.env.AUTH_INSTAGRAM_SECRET,
        allowDangerousEmailAccountLinking: config.allowDangerousEmailAccountLinking,
        profile(profile) {
            return {
                id: profile.id,
                name: profile.username ?? profile.name ?? profile.id,
                // Instagram hands out no address at any scope.
                email: null,
                image: null,
            };
        },
        style: { bg: "#fff", text: "#000" },
    };
}

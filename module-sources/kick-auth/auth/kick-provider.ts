/**
 * The Kick provider, built here because Auth.js ships none.
 *
 * Kick's public API speaks OAuth 2.1, which makes PKCE mandatory rather than
 * optional, and authenticates the token request with the secret in the body
 * instead of the Authorization header. Both are stated below; everything else
 * is an ordinary authorization-code flow through Auth.js's own callback, which
 * is what the manifest's `standardCallback` records.
 *
 * `/public/v1/users` answers with a one-element list rather than an object, so
 * `profile` unwraps it. Kick does return an email address with `user:read`, so
 * unlike the other game logins these accounts start with a real one.
 */
import type { OAuthConfig } from "next-auth/providers";

/** What `/public/v1/users` returns for the token's own user. */
export interface KickProfile {
    data?: Array<{
        user_id: number | string;
        name?: string;
        email?: string;
        profile_picture?: string;
    }>;
}

interface KickProviderConfig {
    env: Record<string, string>;
    allowDangerousEmailAccountLinking: boolean;
}

export default function kickProvider(config: KickProviderConfig): OAuthConfig<KickProfile> {
    return {
        id: "kick",
        name: "Kick",
        type: "oauth",
        authorization: {
            url: "https://id.kick.com/oauth/authorize",
            params: { scope: "user:read" },
        },
        token: "https://id.kick.com/oauth/token",
        userinfo: "https://api.kick.com/public/v1/users",
        // OAuth 2.1: the code verifier is required, and Kick rejects a token
        // request that authenticates with the Authorization header.
        checks: ["pkce", "state"],
        client: { token_endpoint_auth_method: "client_secret_post" },
        clientId: config.env.AUTH_KICK_ID,
        clientSecret: config.env.AUTH_KICK_SECRET,
        allowDangerousEmailAccountLinking: config.allowDangerousEmailAccountLinking,
        profile(profile) {
            const user = profile.data?.[0];
            return {
                id: String(user?.user_id ?? ""),
                name: user?.name ?? null,
                email: user?.email ?? null,
                image: user?.profile_picture ?? null,
            };
        },
        style: { bg: "#53fc18", text: "#000" },
    };
}

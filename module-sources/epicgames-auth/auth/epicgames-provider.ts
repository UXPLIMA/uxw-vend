/**
 * The Epic Games provider, built here because Auth.js ships none.
 *
 * Epic splits its OAuth across two hosts: the authorization screen is on
 * epicgames.com, where the player is signed in, while the token and userinfo
 * endpoints are on the Epic Online Services API. Nothing else about the flow is
 * unusual, so the redirect URL is Auth.js's own and the manifest says as much
 * with `standardCallback`.
 *
 * Epic never returns an email address. Core turns that into a placeholder in
 * the reserved `.invalid` TLD (see `auth-adapter.ts`), which is why `profile`
 * can honestly report null instead of inventing something deliverable.
 */
import type { OAuthConfig } from "next-auth/providers";

/** What `/epic/oauth/v2/userInfo` returns. Only `sub` is guaranteed. */
export interface EpicGamesProfile {
    sub: string;
    display_name?: string;
    displayName?: string;
    preferred_username?: string;
}

interface EpicGamesProviderConfig {
    env: Record<string, string>;
    allowDangerousEmailAccountLinking: boolean;
}

export default function epicGamesProvider(
    config: EpicGamesProviderConfig,
): OAuthConfig<EpicGamesProfile> {
    return {
        id: "epicgames",
        name: "Epic Games",
        type: "oauth",
        authorization: {
            url: "https://www.epicgames.com/id/authorize",
            params: { scope: "basic_profile", response_type: "code" },
        },
        token: "https://api.epicgames.dev/epic/oauth/v2/token",
        userinfo: "https://api.epicgames.dev/epic/oauth/v2/userInfo",
        clientId: config.env.AUTH_EPICGAMES_ID,
        clientSecret: config.env.AUTH_EPICGAMES_SECRET,
        allowDangerousEmailAccountLinking: config.allowDangerousEmailAccountLinking,
        profile(profile) {
            return {
                id: profile.sub,
                // The display name is the Epic account name; the account id is
                // the fallback, because a display name is optional there.
                name: profile.display_name ?? profile.displayName ?? profile.preferred_username ?? profile.sub,
                email: null,
                image: null,
            };
        },
        style: { bg: "#2a2a2a", text: "#fff" },
    };
}

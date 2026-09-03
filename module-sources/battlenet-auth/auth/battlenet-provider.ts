/**
 * The Battle.net provider.
 *
 * Auth.js ships this one, so the module only builds it because Battle.net
 * needs a third setting the built-in declaration shape has no room for: the
 * region issuer. Battle.net runs a separate OIDC issuer per region and the
 * discovery document lives under it, so a client registered in Europe cannot
 * be verified against the Americas issuer.
 *
 * The manifest names all three env vars, so core leaves the provider off until
 * every one of them is set, and marks `standardCallback` because this is an
 * ordinary Auth.js flow: the redirect URL is `/api/auth/callback/battlenet`.
 */
import BattleNet from "next-auth/providers/battlenet";

/** The issuers Battle.net actually serves. See develop.battle.net regionality. */
const ISSUERS = [
    "https://oauth.battle.net",
    "https://us.battle.net/oauth",
    "https://eu.battle.net/oauth",
    "https://kr.battle.net/oauth",
    "https://tw.battle.net/oauth",
    "https://oauth.battlenet.com.cn",
    "https://www.battlenet.com.cn/oauth",
] as const;

type BattleNetIssuer = (typeof ISSUERS)[number];

interface BattleNetProviderConfig {
    env: Record<string, string>;
    allowDangerousEmailAccountLinking: boolean;
}

export default function battlenetProvider(config: BattleNetProviderConfig) {
    const issuer = config.env.AUTH_BATTLENET_ISSUER.replace(/\/+$/, "");
    if (!(ISSUERS as readonly string[]).includes(issuer)) {
        // Thrown rather than defaulted: guessing a region would send every
        // sign-in to an issuer the client is not registered with, and the
        // failure would surface as an opaque OAuth error at the callback.
        throw new Error(
            `AUTH_BATTLENET_ISSUER must be one of ${ISSUERS.join(", ")} - got "${issuer}"`,
        );
    }

    return BattleNet({
        clientId: config.env.AUTH_BATTLENET_ID,
        clientSecret: config.env.AUTH_BATTLENET_SECRET,
        issuer: issuer as BattleNetIssuer,
        allowDangerousEmailAccountLinking: config.allowDangerousEmailAccountLinking,
    });
}

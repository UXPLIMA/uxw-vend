/**
 * The Apple provider.
 *
 * Auth.js ships this one, and everything about the flow is theirs - the OIDC
 * discovery, the `form_post` response mode, the `user` field Apple sends once
 * and never again. The module exists only because Apple's "client secret" is a
 * token the site signs for itself, so it takes four settings rather than two
 * and one of them is a private key.
 *
 * The token is minted here, at startup, and lasts the six months Apple allows.
 * That is not a rotation strategy on its own - a process running longer than
 * six months would eventually present an expired secret - but a deploy or a
 * restart renews it, and no admin has to remember a date.
 */
import Apple from "next-auth/providers/apple";
import { mintClientSecret } from "../lib/client-secret";

interface AppleProviderConfig {
    env: Record<string, string>;
    allowDangerousEmailAccountLinking: boolean;
}

export default function appleProvider(config: AppleProviderConfig) {
    return Apple({
        clientId: config.env.AUTH_APPLE_ID,
        clientSecret: mintClientSecret({
            clientId: config.env.AUTH_APPLE_ID,
            teamId: config.env.AUTH_APPLE_TEAM_ID,
            keyId: config.env.AUTH_APPLE_KEY_ID,
            privateKey: config.env.AUTH_APPLE_PRIVATE_KEY,
        }),
        allowDangerousEmailAccountLinking: config.allowDangerousEmailAccountLinking,
    });
}

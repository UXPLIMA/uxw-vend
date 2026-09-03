/**
 * The Steam provider, built by this module rather than imported from Auth.js.
 *
 * Auth.js ships no Steam provider and could not easily: its OAuth pipeline
 * exchanges an authorization code at a token endpoint, and Steam's OpenID 2.0
 * flow has neither. So the OpenID half runs in this module's own routes, and
 * what reaches Auth.js is a credentials provider whose one credential is a
 * single-use ticket minted by that callback.
 *
 * The manifest points `authProviders[0].factory` at this file and names
 * `AUTH_STEAM_API_KEY` in `envVars`, so core imports the default export
 * statically and calls it only once that key is set.
 */
import Credentials from "next-auth/providers/credentials";
import { consumeTicket } from "../lib/steam-ticket";
import { fetchPlayerSummary } from "../lib/steam-profile";
import { upsertSteamUser, STEAM_PROVIDER_ID } from "../lib/steam-user";

interface SteamProviderConfig {
    env: Record<string, string>;
    allowDangerousEmailAccountLinking: boolean;
}

export default function steamProvider(config: SteamProviderConfig) {
    const apiKey = config.env.AUTH_STEAM_API_KEY;

    return Credentials({
        id: STEAM_PROVIDER_ID,
        name: "Steam",
        // Not a form anyone fills in: the sign-in page sends the visitor to
        // this module's start route, and the ticket comes back from Steam.
        credentials: { ticket: { label: "Steam ticket", type: "text" } },
        async authorize(credentials) {
            const ticket = typeof credentials?.ticket === "string" ? credentials.ticket : "";
            const steamId = await consumeTicket(ticket);
            if (!steamId) return null;

            const player = await fetchPlayerSummary(steamId, apiKey);
            if (!player) return null;

            return await upsertSteamUser(player);
        },
    });
}

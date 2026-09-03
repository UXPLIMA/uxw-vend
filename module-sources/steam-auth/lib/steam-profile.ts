/**
 * Steam's OpenID assertion proves an id and nothing else - no name, no avatar.
 * Those come from the Web API, which is why this module needs an API key on
 * top of the OpenID flow that needs no credentials at all.
 */

export interface SteamPlayer {
    steamId: string;
    personaName: string;
    avatar: string | null;
    profileUrl: string | null;
}

const SUMMARIES_URL = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/";

interface SummaryResponse {
    response?: {
        players?: Array<{
            steamid?: string;
            personaname?: string;
            avatarfull?: string;
            profileurl?: string;
        }>;
    };
}

/**
 * Looks up a player, or returns null if Steam has nothing to say about them.
 *
 * A failure here is not a security problem - the id is already proven - but it
 * is a reason to abandon the sign-in rather than create an account with no
 * name, so callers treat null as a hard stop.
 */
export async function fetchPlayerSummary(
    steamId: string,
    apiKey: string,
    fetchImpl: typeof fetch = fetch,
): Promise<SteamPlayer | null> {
    const url = `${SUMMARIES_URL}?key=${encodeURIComponent(apiKey)}&steamids=${encodeURIComponent(steamId)}`;
    const response = await fetchImpl(url);
    if (!response.ok) return null;

    const data = (await response.json()) as SummaryResponse;
    const player = data.response?.players?.[0];
    if (!player || player.steamid !== steamId) return null;

    return {
        steamId,
        personaName: player.personaname?.trim() || `Steam ${steamId.slice(-6)}`,
        avatar: player.avatarfull || null,
        profileUrl: player.profileurl || null,
    };
}

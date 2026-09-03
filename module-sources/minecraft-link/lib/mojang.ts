/**
 * Resolving a name to a Mojang UUID.
 *
 * Names are rentable - a player can change theirs and someone else can take
 * the old one - so the UUID is the identity worth storing. This is
 * best-effort: Mojang's API is not always reachable, and a link that works
 * without a UUID is better than a link that fails because a third party was
 * down.
 */

export interface MojangProfile {
    /** The name in Mojang's own capitalisation. */
    name: string;
    /** Dashed UUID. */
    uuid: string;
}

const PROFILE_URL = "https://api.mojang.com/users/profiles/minecraft/";

/** Mojang returns UUIDs undashed; every other tool expects them dashed. */
function dashed(raw: string): string {
    if (raw.includes("-")) return raw;
    return [raw.slice(0, 8), raw.slice(8, 12), raw.slice(12, 16), raw.slice(16, 20), raw.slice(20)].join("-");
}

/** A Minecraft name is 3-16 characters of letters, digits and underscores. */
export const MINECRAFT_USERNAME = /^[A-Za-z0-9_]{3,16}$/;

export async function lookupProfile(
    username: string,
    fetchImpl: typeof fetch = fetch,
): Promise<MojangProfile | null> {
    if (!MINECRAFT_USERNAME.test(username)) return null;
    try {
        const response = await fetchImpl(PROFILE_URL + encodeURIComponent(username));
        if (!response.ok) return null;
        const data = (await response.json()) as { name?: string; id?: string };
        if (!data?.name || !data?.id) return null;
        return { name: data.name, uuid: dashed(data.id) };
    } catch {
        // Mojang unreachable. The caller falls back to the name as typed.
        return null;
    }
}

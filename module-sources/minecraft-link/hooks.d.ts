/**
 * Turning an in-game name into a member of this site.
 *
 * This module is the one that knows: a member proves an account by reading a
 * code whispered to them in game, so the link here is evidence rather than a
 * claim. Another module that hears about a player - a ban from a server
 * plugin, a purchase made in game - needs the member behind the name, and has
 * no business reading this module's table to find it.
 *
 * The answer is null when nobody linked that name, which is the normal case
 * and not an error: the thing that happened still happened, it just has no
 * member attached yet.
 */
interface GameAccountMatch {
    userId: string | null;
}

declare global {
    interface BlysisFilterPayloads {
        "game-account.resolve": GameAccountMatch;
    }

    interface BlysisFilterContexts {
        /** Either identifies the account; a UUID survives a rename and a name does not. */
        "game-account.resolve": { username?: string | null; uuid?: string | null };
    }
}

export {};

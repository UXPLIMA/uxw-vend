/**
 * Payload contract for the hooks this module fires.
 *
 * A store can use these to keep the player name it delivers to in step with
 * the one the user proved they own, instead of asking for it again at
 * checkout.
 */
declare global {
    interface UxwVendHookPayloads {
        "minecraft.account.linked": MinecraftLinkHookPayload;
        "minecraft.account.unlinked": MinecraftLinkHookPayload;
    }
}

interface MinecraftLinkHookPayload {
    userId: string;
    /** In-game name, in Mojang's capitalisation when it could be resolved. */
    username: string;
    /** Dashed Mojang UUID, or null when Mojang could not be reached. */
    uuid: string | null;
}

export {};

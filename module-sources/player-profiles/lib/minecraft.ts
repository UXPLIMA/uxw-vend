/**
 * Get Minecraft player skin avatar URL
 * Uses mc-heads.net (free, no API key needed)
 */
export function getMinecraftAvatar(username: string, size: number = 64): string {
    return `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size}`;
}

/**
 * Get Minecraft player skin avatar URL
 * Uses mc-heads.net (free, no API key needed)
 */
export function getMinecraftAvatar(username: string, size: number = 64): string {
    return `https://mc-heads.net/avatar/${encodeURIComponent(username)}/${size}`;
}

export function getMinecraftHead(username: string, size: number = 64): string {
    return `https://mc-heads.net/head/${encodeURIComponent(username)}/${size}`;
}

export function getMinecraftBody(username: string, size: number = 128): string {
    return `https://mc-heads.net/body/${encodeURIComponent(username)}/${size}`;
}

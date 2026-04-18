import { prisma } from "@/core/lib/db";

export interface ServerStatus {
    online: boolean;
    players: { online: number; max: number };
    version: string;
    motd: string;
}

function isPrivateIP(host: string): boolean {
    const privateRanges = [
        /^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./, /^0\./, /^::1$/, /^fc00:/i, /^fe80:/i,
    ];
    return privateRanges.some((r) => r.test(host));
}

export async function getServerStatus(): Promise<ServerStatus> {
    try {
        const settings = await prisma.setting.findMany({
            where: { key: { startsWith: "server_" } },
        });
        const map: Record<string, string> = {};
        settings.forEach((s: { key: string; value: unknown }) => { map[s.key] = s.value as string; });

        const host = map.server_host || process.env.MC_HOST || "localhost";
        const port = parseInt(map.server_port || process.env.MC_PORT || "25565");

        // Prevent SSRF: block private/internal IP addresses
        if (isPrivateIP(host)) {
            return { online: false, players: { online: 0, max: 0 }, version: "Unknown", motd: "" };
        }

        const response = await fetch(
            `https://api.mcsrvstat.us/3/${host}:${port}`,
            { next: { revalidate: 30 } }
        );

        if (response.ok) {
            const data = await response.json();
            return {
                online: data.online || false,
                players: { online: data.players?.online || 0, max: data.players?.max || 0 },
                version: data.version || "Unknown",
                motd: data.motd?.clean?.[0] || "",
            };
        }
    } catch { /* ignore */ }

    return { online: false, players: { online: 0, max: 0 }, version: "Unknown", motd: "" };
}

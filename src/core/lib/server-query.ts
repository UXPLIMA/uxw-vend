import { Socket } from "net";

interface ServerStatus {
    online: boolean;
    players: { online: number; max: number };
    version: string;
    motd: string;
}

/**
 * Query Minecraft server status via SLP (Server List Ping)
 * Works with vanilla and most modded servers
 */
export async function queryMinecraftServer(
    host: string,
    port: number = 25565,
    timeout: number = 5000
): Promise<ServerStatus> {
    return new Promise((resolve) => {
        const socket = new Socket();
        let responded = false;

        const fail = () => {
            if (responded) return;
            responded = true;
            socket.destroy();
            resolve({ online: false, players: { online: 0, max: 0 }, version: "", motd: "" });
        };

        socket.setTimeout(timeout);
        socket.on("timeout", fail);
        socket.on("error", fail);

        socket.connect(port, host, () => {
            // Send handshake + status request (MC protocol)
            const hostBuf = Buffer.from(host, "utf8");
            const handshake = Buffer.alloc(7 + hostBuf.length);
            let offset = 0;

            // Packet ID (0x00)
            handshake[offset++] = 0x00;
            // Protocol version (varint: -1 = 0xff 0xff 0xff 0xff 0x0f)
            handshake[offset++] = 0xff;
            handshake[offset++] = 0xff;
            handshake[offset++] = 0xff;
            handshake[offset++] = 0xff;
            handshake[offset++] = 0x0f;

            // This is a simplified approach - use the legacy ping
            // Legacy server list ping (0xFE 0x01)
            const legacyPing = Buffer.from([0xFE, 0x01]);
            socket.write(legacyPing);
        });

        let data = Buffer.alloc(0);

        socket.on("data", (chunk) => {
            data = Buffer.concat([data, chunk]);

            if (data.length > 3 && data[0] === 0xFF) {
                responded = true;
                socket.destroy();

                try {
                    // Parse legacy ping response
                    const str = data.slice(3).toString("utf16le");
                    const parts = str.split("\0");

                    if (parts.length >= 6) {
                        resolve({
                            online: true,
                            version: parts[2] || "",
                            motd: parts[3] || "",
                            players: {
                                online: parseInt(parts[4]) || 0,
                                max: parseInt(parts[5]) || 0,
                            },
                        });
                    } else {
                        resolve({ online: true, players: { online: 0, max: 0 }, version: "", motd: "" });
                    }
                } catch {
                    resolve({ online: true, players: { online: 0, max: 0 }, version: "", motd: "" });
                }
            }
        });
    });
}

// Cache server status (refresh every 60s)
let cachedStatus: ServerStatus | null = null;
let lastFetch = 0;

export async function getServerStatus(): Promise<ServerStatus> {
    const now = Date.now();
    if (cachedStatus && now - lastFetch < 60000) return cachedStatus;

    const host = process.env.MC_SERVER_HOST || process.env.RCON_HOST;
    const port = parseInt(process.env.MC_SERVER_PORT || "25565");

    if (!host) {
        return { online: false, players: { online: 0, max: 0 }, version: "", motd: "" };
    }

    cachedStatus = await queryMinecraftServer(host, port);
    lastFetch = now;
    return cachedStatus;
}

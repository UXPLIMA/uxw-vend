import { prisma } from "@/core/lib/db";

interface RconConfig {
    host: string;
    port: number;
    password: string;
}

/** Get RCON config from global settings or env vars (fallback/default server) */
async function getDefaultRconConfig(): Promise<RconConfig | null> {
    if (process.env.RCON_HOST && process.env.RCON_PASSWORD) {
        return {
            host: process.env.RCON_HOST,
            port: parseInt(process.env.RCON_PORT || "25575"),
            password: process.env.RCON_PASSWORD,
        };
    }
    try {
        const settings = await prisma.setting.findMany({
            where: { key: { startsWith: "rcon_" } },
        });
        const map: Record<string, string> = {};
        settings.forEach((s: { key: string; value: unknown }) => { map[s.key] = s.value as string; });
        if (map.rcon_host && map.rcon_password) {
            return {
                host: map.rcon_host,
                port: parseInt(map.rcon_port || "25575"),
                password: map.rcon_password,
            };
        }
    } catch { /* ignore */ }
    return null;
}

/** Get RCON config for a specific GameServer by ID */
async function getServerRconConfig(serverId: string): Promise<RconConfig | null> {
    try {
        const server = await prisma.gameServer.findUnique({
            where: { id: serverId },
            select: { host: true, rconPort: true, rconPassword: true, isActive: true },
        });
        if (!server || !server.isActive || !server.rconPort || !server.rconPassword) return null;
        return { host: server.host, port: server.rconPort, password: server.rconPassword };
    } catch {
        return null;
    }
}

/** Resolve RCON config — specific server if serverId given, else default */
async function resolveRconConfig(serverId?: string | null): Promise<RconConfig | null> {
    if (serverId) {
        const serverConfig = await getServerRconConfig(serverId);
        if (serverConfig) return serverConfig;
        // Fall back to default if server not found or missing RCON config
    }
    return getDefaultRconConfig();
}

export function getRconEnabled(): boolean {
    return !!(process.env.RCON_HOST && process.env.RCON_PASSWORD);
}

/** Send a single RCON command, optionally to a specific server */
export async function sendRconCommand(command: string, serverId?: string | null): Promise<string> {
    const config = await resolveRconConfig(serverId);
    if (!config) throw new Error("RCON not configured");
    try {
        // eslint-disable-next-line no-eval
        const { Rcon } = eval('require')("rcon-client") as { Rcon: { connect: (cfg: RconConfig) => Promise<{ send: (cmd: string) => Promise<string>; end: () => void }> } };
        const rcon = await Rcon.connect(config);
        try {
            return await rcon.send(command);
        } finally {
            rcon.end();
        }
    } catch (err) {
        throw new Error(`RCON failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
}

function sanitizeRconArg(input: string): string {
    return input.replace(/[^a-zA-Z0-9_\-. ]/g, '');
}

/** Execute product delivery commands — routes each command to its target server */
export async function deliverProduct(params: {
    playerName: string;
    productName: string;
    commands: { command: string; serverId?: string | null }[];
    quantity?: number;
    variables?: Record<string, string>;
}): Promise<{ success: boolean; results: string[] }> {
    const results: string[] = [];
    const safePlayerName = sanitizeRconArg(params.playerName);
    const safeProductName = sanitizeRconArg(params.productName);

    for (const cmd of params.commands) {
        let command = cmd.command
            .replace(/\{player\}/g, safePlayerName)
            .replace(/\{product\}/g, safeProductName)
            .replace(/\{quantity\}/g, String(params.quantity || 1));

        // Replace custom variable placeholders
        if (params.variables) {
            for (const [key, value] of Object.entries(params.variables)) {
                command = command.replace(new RegExp(`\\{${key}\\}`, "g"), sanitizeRconArg(value));
            }
        }

        try {
            const result = await sendRconCommand(command, cmd.serverId);
            results.push(result);
        } catch (err) {
            results.push(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
            return { success: false, results };
        }
    }
    return { success: true, results };
}

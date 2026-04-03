import { Rcon } from "rcon-client";
import { prisma } from "./db";

interface RconConfig {
    host: string;
    port: number;
    password: string;
}

async function getRconConfig(): Promise<RconConfig | null> {
    // Try env first
    if (process.env.RCON_HOST && process.env.RCON_PASSWORD) {
        return {
            host: process.env.RCON_HOST,
            port: parseInt(process.env.RCON_PORT || "25575"),
            password: process.env.RCON_PASSWORD,
        };
    }

    // Try settings DB
    try {
        const settings = await prisma.setting.findMany({
            where: { key: { startsWith: "rcon_" } },
        });
        const map: Record<string, string> = {};
        settings.forEach((s) => { map[s.key] = s.value as string; });

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

export function getRconEnabled(): boolean {
    return !!(process.env.RCON_HOST && process.env.RCON_PASSWORD);
}

/**
 * Send a command to the game server via RCON
 */
export async function sendRconCommand(command: string): Promise<string> {
    const config = await getRconConfig();
    if (!config) throw new Error("RCON not configured");

    const rcon = await Rcon.connect({
        host: config.host,
        port: config.port,
        password: config.password,
    });

    try {
        const response = await rcon.send(command);
        return response;
    } finally {
        rcon.end();
    }
}

/**
 * Execute product delivery commands on purchase
 * Commands support placeholders: {player}, {product}, {quantity}
 */
export async function deliverProduct(params: {
    playerName: string;
    productName: string;
    commands: string[];
    quantity?: number;
}): Promise<{ success: boolean; results: string[] }> {
    const results: string[] = [];

    for (const cmd of params.commands) {
        const command = cmd
            .replace(/\{player\}/g, params.playerName)
            .replace(/\{product\}/g, params.productName)
            .replace(/\{quantity\}/g, String(params.quantity || 1));

        try {
            const result = await sendRconCommand(command);
            results.push(result);
        } catch (err) {
            results.push(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
            return { success: false, results };
        }
    }

    return { success: true, results };
}

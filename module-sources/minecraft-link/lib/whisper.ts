/**
 * Delivering the code to the player, in game.
 *
 * The message goes out as a private in-game message through whichever module
 * can reach a game server - this one never touches RCON directly. Minecraft's
 * `tell` is the default; the command is a setting because a Bedrock or
 * proxy setup spells it differently, and because an operator may want to
 * route it through a plugin's own command.
 */
import { applyFiltersAsync } from "@/core/sdk";
import { prisma } from "@/core/sdk/server";

export const WHISPER_COMMAND_SETTING = "minecraft_link_whisper_command";
export const DEFAULT_WHISPER_COMMAND = "tell {player} {message}";

/**
 * Vanilla says this when the name matches nobody online. Worth spotting,
 * because "the player is not on the server" is the one failure the person at
 * the website can actually fix.
 */
const OFFLINE_HINTS = [/no player was found/i, /that player cannot be found/i, /player not found/i];

export type WhisperOutcome =
    | { ok: true }
    | { ok: false; reason: "no-server" | "offline" | "failed"; detail: string | null };

interface CommandOutcome {
    handled: boolean;
    ok: boolean;
    output: string | null;
    error: string | null;
}

/** Only what can appear in a Minecraft name survives into the command line. */
function safeName(username: string): string {
    return username.replace(/[^A-Za-z0-9_]/g, "");
}

async function whisperTemplate(): Promise<string> {
    const row = await prisma.setting.findUnique({ where: { key: WHISPER_COMMAND_SETTING } }).catch(() => null);
    const value = typeof row?.value === "string" ? row.value.trim() : "";
    return value || DEFAULT_WHISPER_COMMAND;
}

export async function whisper(params: {
    username: string;
    message: string;
    serverId?: string | null;
}): Promise<WhisperOutcome> {
    const template = await whisperTemplate();
    const command = template
        .replace(/\{player\}/g, safeName(params.username))
        .replace(/\{message\}/g, params.message);

    const result = (await applyFiltersAsync(
        "server.command",
        { handled: false, ok: false, output: null, error: null },
        { command, serverId: params.serverId ?? null },
    )) as CommandOutcome;

    if (!result.handled) return { ok: false, reason: "no-server", detail: null };
    if (!result.ok) return { ok: false, reason: "failed", detail: result.error };

    const output = result.output ?? "";
    if (OFFLINE_HINTS.some((hint) => hint.test(output))) {
        return { ok: false, reason: "offline", detail: output };
    }
    return { ok: true };
}

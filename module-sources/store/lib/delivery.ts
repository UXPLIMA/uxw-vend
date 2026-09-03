/**
 * Running the commands a product delivers on purchase.
 *
 * This module used to carry its own RCON client, a near-copy of the one in the
 * servers module that had already drifted from it. It carries none now: the
 * store knows what to run, the servers module knows how to reach a server, and
 * they meet at the `server.command` filter. A store with no game-server module
 * installed gets `handled: false` back and reports that, rather than a
 * connection error nobody can act on.
 *
 * What stays here is the part that is genuinely the store's: turning a product's
 * command template into a command line.
 */
import { applyFiltersAsync } from "@/core/sdk";

/**
 * Placeholders are substituted into a command line that a game server will
 * parse, so a player name of `x; op attacker` has to come out inert. Only
 * letters, digits, and the punctuation that appears in real player and product
 * names survives.
 */
function sanitizeRconArg(input: string): string {
    return input.replace(/[^a-zA-Z0-9_\-. ]/g, "");
}

export interface DeliveryCommand {
    command: string;
    /** Which server to run it on. Null means the install's default server. */
    serverId?: string | null;
}

export interface DeliveryResult {
    success: boolean;
    results: string[];
}

/**
 * What comes back from the `server.command` chain.
 *
 * Spelled out here rather than reusing the servers module's global interface:
 * that declaration only exists when that module is installed, and this one has
 * to compile either way. The shape is checked structurally at the call.
 */
interface CommandOutcome {
    handled: boolean;
    ok: boolean;
    output: string | null;
    error: string | null;
}

/** Runs one command through whichever module can reach game servers. */
export async function runDeliveryCommand(command: string, serverId?: string | null): Promise<CommandOutcome> {
    return applyFiltersAsync(
        "server.command",
        { handled: false, ok: false, output: null, error: null },
        { command, serverId: serverId ?? null },
    );
}

/**
 * Executes a product's delivery commands in order, stopping at the first
 * failure so a half-delivered purchase is visible rather than silently partial.
 *
 * Commands support `{player}`, `{product}`, `{quantity}`, and any custom
 * variable the product defines.
 */
export async function deliverProduct(params: {
    playerName: string;
    productName: string;
    commands: DeliveryCommand[];
    quantity?: number;
    variables?: Record<string, string>;
}): Promise<DeliveryResult> {
    const results: string[] = [];
    const safePlayerName = sanitizeRconArg(params.playerName);
    const safeProductName = sanitizeRconArg(params.productName);

    for (const entry of params.commands) {
        let command = entry.command
            .replace(/\{player\}/g, safePlayerName)
            .replace(/\{product\}/g, safeProductName)
            .replace(/\{quantity\}/g, String(params.quantity || 1));

        if (params.variables) {
            for (const [key, value] of Object.entries(params.variables)) {
                command = command.replace(new RegExp(`\\{${key}\\}`, "g"), sanitizeRconArg(value));
            }
        }

        const result = await runDeliveryCommand(command, entry.serverId);

        if (!result.handled) {
            results.push("Error: no installed module can reach a game server");
            return { success: false, results };
        }
        if (!result.ok) {
            results.push(`Error: ${result.error ?? "the server refused the command"}`);
            return { success: false, results };
        }
        results.push(result.output ?? "");
    }

    return { success: true, results };
}

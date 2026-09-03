/**
 * The `server.command` contract.
 *
 * Modules never import each other, so a store that has just taken a payment
 * cannot call into this module to run the delivery command. It asks instead,
 * through a filter, and whoever can answer does.
 *
 * The shape is declared here rather than in the modules that emit it, which
 * inverts the usual rule that the emitter owns the payload. It is the right
 * way round for this hook: the value flowing through the chain is the *answer*,
 * and this module is the one that produces it. Two modules already emit the
 * hook (store, minecraft-link) and only this one answers, so putting the
 * declaration in an emitter would mean two copies of it - a duplicate global
 * the moment both are installed.
 *
 * `handled` is what tells a caller the difference between "the command failed"
 * and "nothing on this install can run commands at all". A store with no
 * game-server module installed gets `handled: false` and can say so, rather
 * than reporting a delivery failure that nobody can fix.
 */

declare global {
    interface ServerCommandResult {
        /** True once some module has attempted the command. */
        handled: boolean;
        /** Whether the server accepted it. */
        ok: boolean;
        /** The server's reply, when there was one. */
        output: string | null;
        /** Why it failed, when it did. */
        error: string | null;
    }

    interface ServerCommandRequest {
        /** The command line, already fully substituted and sanitised by the caller. */
        command: string;
        /** Which server to run it on. Omitted means the install's default server. */
        serverId?: string | null;
    }

    interface UxwVendFilterPayloads {
        "server.command": ServerCommandResult;
    }

    /** The question, as opposed to the answer above. */
    interface UxwVendFilterContexts {
        "server.command": ServerCommandRequest;
    }
}

export {};

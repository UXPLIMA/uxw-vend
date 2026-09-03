// @vitest-environment node
/**
 * Getting the code into the player's chat window.
 *
 * This module never touches RCON: it asks through the `server.command` filter
 * and reads the answer. The interesting part is telling apart the three ways
 * that can go wrong, because only one of them - "you are not on the server" -
 * is something the person at the website can fix.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const applyFiltersAsync = vi.fn();
vi.mock("@/core/sdk", () => ({ applyFiltersAsync: (...args: unknown[]) => applyFiltersAsync(...args) }));

const setting = { value: null as string | null };
vi.mock("@/core/sdk/server", () => ({
    prisma: { setting: { findUnique: async () => (setting.value === null ? null : { value: setting.value }) } },
}));

const { whisper, DEFAULT_WHISPER_COMMAND } = await import("@/modules/minecraft-link/lib/whisper");

const sent = () => applyFiltersAsync.mock.calls[0]?.[2] as { command: string; serverId: string | null };

function answer(result: { handled: boolean; ok: boolean; output?: string; error?: string }) {
    applyFiltersAsync.mockResolvedValue({
        handled: result.handled,
        ok: result.ok,
        output: result.output ?? null,
        error: result.error ?? null,
    });
}

beforeEach(() => {
    applyFiltersAsync.mockReset();
    setting.value = null;
});

describe("whisper", () => {
    it("sends Minecraft's tell command by default", async () => {
        answer({ handled: true, ok: true, output: "" });
        await whisper({ username: "Notch", message: "ABC123" });
        expect(DEFAULT_WHISPER_COMMAND).toBe("tell {player} {message}");
        expect(sent().command).toBe("tell Notch ABC123");
    });

    it("uses the operator's own command when one is configured", async () => {
        setting.value = "msg {player} Your code is {message}";
        answer({ handled: true, ok: true, output: "" });
        await whisper({ username: "Notch", message: "ABC123" });
        expect(sent().command).toBe("msg Notch Your code is ABC123");
    });

    it("falls back to the default when the setting is blank", async () => {
        setting.value = "   ";
        answer({ handled: true, ok: true, output: "" });
        await whisper({ username: "Notch", message: "ABC123" });
        expect(sent().command).toBe("tell Notch ABC123");
    });

    // The name comes from a text box and lands in a command line the server
    // parses, so anything a Minecraft name cannot contain is dropped.
    it("strips a name that tries to become a second command", async () => {
        answer({ handled: true, ok: true, output: "" });
        await whisper({ username: "evil; op evil", message: "ABC123" });
        expect(sent().command).toBe("tell evilopevil ABC123");
    });

    it("passes the chosen server through", async () => {
        answer({ handled: true, ok: true, output: "" });
        await whisper({ username: "Notch", message: "ABC123", serverId: "survival" });
        expect(sent().serverId).toBe("survival");
    });

    it("reports that nothing on this install can reach a server", async () => {
        answer({ handled: false, ok: false });
        await expect(whisper({ username: "Notch", message: "ABC123" })).resolves.toMatchObject({
            ok: false,
            reason: "no-server",
        });
    });

    // Vanilla accepts the command and answers in prose, so the only way to
    // know the whisper went nowhere is to read the reply.
    it("spots that the player was not online", async () => {
        answer({ handled: true, ok: true, output: "No player was found" });
        await expect(whisper({ username: "Notch", message: "ABC123" })).resolves.toMatchObject({
            ok: false,
            reason: "offline",
        });
    });

    it("reports a refused command separately", async () => {
        answer({ handled: true, ok: false, error: "RCON connection failed" });
        await expect(whisper({ username: "Notch", message: "ABC123" })).resolves.toMatchObject({
            ok: false,
            reason: "failed",
            detail: "RCON connection failed",
        });
    });

    it("treats a quiet server as success", async () => {
        answer({ handled: true, ok: true, output: "" });
        await expect(whisper({ username: "Notch", message: "ABC123" })).resolves.toEqual({ ok: true });
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The shutdown registry is what makes `requestRestart()` in install-lock.ts
 * safe: SIGTERM has to drain Prisma and clear the scheduler interval before
 * the process goes away. A bug here is unrecoverable in production — it
 * shows up as a hung container that the supervisor SIGKILLs, or as a
 * connection pool that is already exhausted on the next boot.
 *
 * The module keeps process-wide singletons (`installed`, `shuttingDown`,
 * `callbacks`), so every test re-imports it after `vi.resetModules()`.
 *
 * `process.once` is spied rather than exercised for real: registering a
 * genuine SIGTERM listener inside the test runner and then emitting the
 * signal would also run vitest's own handlers. Capturing the callback gives
 * us the same code path with none of that blast radius.
 */

vi.mock("@/core/lib/logger", () => ({
    log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

type Shutdown = typeof import("@/core/lib/shutdown");

interface Harness {
    mod: Shutdown;
    /** Signal name → the handler shutdown.ts registered for it. */
    handlers: Map<string, (signal: NodeJS.Signals) => void>;
    exit: ReturnType<typeof vi.spyOn>;
}

async function load(env: Record<string, string | undefined> = {}): Promise<Harness> {
    for (const [k, v] of Object.entries(env)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    vi.resetModules();

    const handlers = new Map<string, (signal: NodeJS.Signals) => void>();
    vi.spyOn(process, "once").mockImplementation(((name: string, fn: never) => {
        handlers.set(name, fn);
        return process;
    }) as never);
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    const mod = (await import("@/core/lib/shutdown")) as Shutdown;
    return { mod, handlers, exit };
}

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => { });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete process.env.SHUTDOWN_GRACE_MS;
});

describe("shutdown registry", () => {
    it("runs callbacks in reverse registration order", async () => {
        const { mod, handlers } = await load();
        const order: string[] = [];
        mod.onShutdown("prisma", () => { order.push("prisma"); });
        mod.onShutdown("scheduler", () => { order.push("scheduler"); });
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.waitFor(() => expect(order).toHaveLength(2));

        // Late-init code (scheduler) unwinds before early-init code (prisma).
        expect(order).toEqual(["scheduler", "prisma"]);
    });

    it("replaces a callback registered twice under the same name", async () => {
        const { mod, handlers } = await load();
        const calls: string[] = [];
        mod.onShutdown("scheduler", () => { calls.push("first"); });
        mod.onShutdown("scheduler", () => { calls.push("second"); });
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.waitFor(() => expect(calls).toHaveLength(1));

        // A hot-reloaded module must not stack duplicate handlers.
        expect(calls).toEqual(["second"]);
    });

    it("keeps the replaced callback in its original position", async () => {
        const { mod, handlers } = await load();
        const order: string[] = [];
        mod.onShutdown("a", () => { order.push("a"); });
        mod.onShutdown("b", () => { order.push("b"); });
        mod.onShutdown("a", () => { order.push("a2"); });
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.waitFor(() => expect(order).toHaveLength(2));

        // Re-registering must not promote "a" to the end of the list —
        // unwind order encodes init order, not last-write order.
        expect(order).toEqual(["b", "a2"]);
    });

    it("awaits async callbacks before exiting", async () => {
        const { mod, handlers, exit } = await load();
        let resolved = false;
        mod.onShutdown("slow", async () => {
            await new Promise((r) => setTimeout(r, 10));
            resolved = true;
        });
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.waitFor(() => expect(exit).toHaveBeenCalled());
        expect(resolved).toBe(true);
        expect(exit).toHaveBeenCalledWith(0);
    });

    it("runs later callbacks after an earlier one throws", async () => {
        const { mod, handlers, exit } = await load();
        const ran: string[] = [];
        mod.onShutdown("prisma", () => { ran.push("prisma"); });
        mod.onShutdown("broken", () => { throw new Error("handler exploded"); });
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.waitFor(() => expect(exit).toHaveBeenCalled());

        expect(ran).toEqual(["prisma"]);
        expect(exit).toHaveBeenCalledWith(0);
    });

    it("runs later callbacks after an earlier one rejects", async () => {
        const { mod, handlers, exit } = await load();
        const ran: string[] = [];
        mod.onShutdown("prisma", () => { ran.push("prisma"); });
        mod.onShutdown("broken", async () => { throw new Error("async explode"); });
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.waitFor(() => expect(exit).toHaveBeenCalled());

        expect(ran).toEqual(["prisma"]);
        expect(exit).toHaveBeenCalledWith(0);
    });

    it("ignores a second signal while already shutting down", async () => {
        const { mod, handlers, exit } = await load();
        let runs = 0;
        mod.onShutdown("count", async () => {
            runs += 1;
            await new Promise((r) => setTimeout(r, 20));
        });
        mod.installShutdownHandlers();

        const handle = handlers.get("SIGTERM")!;
        handle("SIGTERM");
        handle("SIGTERM");
        await vi.waitFor(() => expect(exit).toHaveBeenCalled());

        expect(runs).toBe(1);
    });

    it("reports isShuttingDown before and after a signal", async () => {
        const { mod, handlers, exit } = await load();
        expect(mod.isShuttingDown()).toBe(false);
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.waitFor(() => expect(exit).toHaveBeenCalled());

        expect(mod.isShuttingDown()).toBe(true);
    });

    it("handles SIGINT as well as SIGTERM", async () => {
        const { mod, handlers, exit } = await load();
        const ran: string[] = [];
        mod.onShutdown("prisma", () => { ran.push("prisma"); });
        mod.installShutdownHandlers();

        expect([...handlers.keys()].sort()).toEqual(["SIGINT", "SIGTERM"]);
        handlers.get("SIGINT")!("SIGINT");
        await vi.waitFor(() => expect(exit).toHaveBeenCalled());
        expect(ran).toEqual(["prisma"]);
    });

    it("installs signal handlers only once", async () => {
        const { mod } = await load();
        mod.installShutdownHandlers();
        mod.installShutdownHandlers();
        mod.installShutdownHandlers();

        // Two calls total — SIGTERM and SIGINT — not six. Repeat calls from
        // several server-entry modules must stay cheap.
        expect(process.once).toHaveBeenCalledTimes(2);
    });

    it("exits 0 with no callbacks registered", async () => {
        const { mod, handlers, exit } = await load();
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    });
});

describe("shutdown grace window", () => {
    it("force-exits 1 when a handler hangs past the grace window", async () => {
        vi.useFakeTimers();
        const { mod, handlers, exit } = await load({ SHUTDOWN_GRACE_MS: "500" });
        mod.onShutdown("hangs", () => new Promise<void>(() => { /* never resolves */ }));
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        expect(exit).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(500);
        expect(exit).toHaveBeenCalledWith(1);
    });

    it("clears the force-exit timer when shutdown completes in time", async () => {
        vi.useFakeTimers();
        const { mod, handlers, exit } = await load({ SHUTDOWN_GRACE_MS: "500" });
        mod.onShutdown("quick", () => { });
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.advanceTimersByTimeAsync(0);
        expect(exit).toHaveBeenCalledWith(0);

        // The force-exit path must not fire afterwards and turn a clean
        // shutdown into a non-zero exit code.
        await vi.advanceTimersByTimeAsync(1000);
        expect(exit).toHaveBeenCalledTimes(1);
    });

    it("falls back to 15s when SHUTDOWN_GRACE_MS is unset", async () => {
        vi.useFakeTimers();
        const { mod, handlers, exit } = await load({ SHUTDOWN_GRACE_MS: undefined });
        mod.onShutdown("hangs", () => new Promise<void>(() => { }));
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.advanceTimersByTimeAsync(14_999);
        expect(exit).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(exit).toHaveBeenCalledWith(1);
    });

    it.each(["not-a-number", "0", "-1", ""])(
        "falls back to 15s when SHUTDOWN_GRACE_MS is %o",
        async (raw) => {
            vi.useFakeTimers();
            const { mod, handlers, exit } = await load({ SHUTDOWN_GRACE_MS: raw });
            mod.onShutdown("hangs", () => new Promise<void>(() => { }));
            mod.installShutdownHandlers();

            handlers.get("SIGTERM")!("SIGTERM");
            await vi.advanceTimersByTimeAsync(14_999);
            expect(exit).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(1);
            expect(exit).toHaveBeenCalledWith(1);
        },
    );

    it("honours a custom SHUTDOWN_GRACE_MS", async () => {
        vi.useFakeTimers();
        const { mod, handlers, exit } = await load({ SHUTDOWN_GRACE_MS: "30000" });
        mod.onShutdown("hangs", () => new Promise<void>(() => { }));
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");
        await vi.advanceTimersByTimeAsync(29_999);
        expect(exit).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(exit).toHaveBeenCalledWith(1);
    });

    it("does not hold the event loop open with the force-exit timer", async () => {
        vi.useFakeTimers();
        const { mod, handlers } = await load({ SHUTDOWN_GRACE_MS: "500" });
        const unref = vi.fn();
        const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout")
            .mockImplementation((() => ({ unref })) as never);
        mod.installShutdownHandlers();

        handlers.get("SIGTERM")!("SIGTERM");

        // A referenced timer would keep a process alive for the whole grace
        // window even when every handler finished instantly.
        expect(setTimeoutSpy).toHaveBeenCalled();
        expect(unref).toHaveBeenCalled();
    });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * logger.ts was at 9.6%. It has two entirely separate output paths — a
 * coloured console line in dev and a JSON line to stdout/stderr in
 * production — and only one of them ever runs locally, so a break in the
 * production path would surface as "the log aggregator is empty" long
 * after deploy. The level filter and the AsyncLocalStorage correlation-id
 * propagation were likewise unverified.
 *
 * `isDev` and `MIN_LEVEL` are read once at module scope, so every test
 * re-imports the module after setting the env it needs.
 */

const { headersMock } = vi.hoisted(() => ({ headersMock: vi.fn() }));

vi.mock("next/headers", () => ({ headers: headersMock }));

type Logger = typeof import("@/core/lib/logger");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let consoleLog: ReturnType<typeof vi.spyOn>;
let stdout: ReturnType<typeof vi.spyOn>;
let stderr: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    consoleLog = vi.spyOn(console, "log").mockImplementation(() => { });
    stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    headersMock.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

async function load(env: Record<string, string> = {}): Promise<Logger> {
    vi.resetModules();
    vi.stubEnv("LOG_LEVEL", "");
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return (await import("@/core/lib/logger")) as Logger;
}

const loadDev = (env: Record<string, string> = {}) =>
    load({ NODE_ENV: "development", ...env });
const loadProd = (env: Record<string, string> = {}) =>
    load({ NODE_ENV: "production", ...env });

/** Parse the single JSON line written in production mode. */
function jsonLine(spy: ReturnType<typeof vi.spyOn>, index = 0): Record<string, unknown> {
    const call = spy.mock.calls[index];
    if (!call) throw new Error("nothing was written");
    return JSON.parse(String(call[0]));
}

// ===========================================================================

describe("level filtering", () => {
    it("emits every level in dev, where the floor is debug", async () => {
        const { log } = await loadDev();

        log.debug("d"); log.info("i"); log.warn("w"); log.error("e");

        expect(consoleLog).toHaveBeenCalledTimes(4);
    });

    it("drops debug in production, where the floor is info", async () => {
        const { log } = await loadProd();

        log.debug("d");
        expect(stdout).not.toHaveBeenCalled();

        log.info("i");
        expect(stdout).toHaveBeenCalledTimes(1);
    });

    it("honours an explicit LOG_LEVEL floor", async () => {
        const { log } = await loadDev({ LOG_LEVEL: "warn" });

        log.debug("d"); log.info("i");
        expect(consoleLog).not.toHaveBeenCalled();

        log.warn("w"); log.error("e");
        expect(consoleLog).toHaveBeenCalledTimes(2);
    });

    it("can be silenced above error", async () => {
        const { log } = await loadDev({ LOG_LEVEL: "error" });

        log.warn("w");
        expect(consoleLog).not.toHaveBeenCalled();

        log.error("e");
        expect(consoleLog).toHaveBeenCalledTimes(1);
    });
});

describe("dev output", () => {
    it("prefixes the level and prints the message", async () => {
        const { log } = await loadDev();
        log.info("hello");

        const line = String(consoleLog.mock.calls[0]![0]);
        expect(line).toContain("[INFO]");
        expect(line).toContain("hello");
    });

    it("abbreviates the correlation id to eight characters", async () => {
        const mod = await loadDev();
        mod.runWithLogContext(
            { correlationId: "0123456789abcdef-0000" },
            () => mod.log.info("hello"),
        );

        expect(String(consoleLog.mock.calls[0]![0])).toContain("[01234567]");
    });

    it("renders method, path, status and duration when present", async () => {
        const { log } = await loadDev();
        log.info("done", { method: "GET", path: "/api/x", statusCode: 200, durationMs: 12 });

        const line = String(consoleLog.mock.calls[0]![0]);
        expect(line).toContain("GET");
        expect(line).toContain("/api/x");
        expect(line).toContain("→ 200");
        expect(line).toContain("(12ms)");
    });

    it("renders a zero duration rather than omitting it", async () => {
        const { log } = await loadDev();
        log.info("fast", { durationMs: 0 });
        expect(String(consoleLog.mock.calls[0]![0])).toContain("(0ms)");
    });

    it("prints the stack on its own line", async () => {
        const { log } = await loadDev();
        log.error("boom", { stack: "Error: boom\n    at x" });

        expect(consoleLog).toHaveBeenCalledTimes(2);
        expect(consoleLog.mock.calls[1]![0]).toBe("Error: boom\n    at x");
    });
});

describe("production output", () => {
    it("writes one JSON line per entry to stdout", async () => {
        const { log } = await loadProd();
        log.info("hello", { userId: "u1" });

        const call = String(stdout.mock.calls[0]![0]);
        expect(call.endsWith("\n")).toBe(true);
        expect(JSON.parse(call)).toMatchObject({
            level: "info",
            message: "hello",
            userId: "u1",
        });
    });

    it("includes an ISO timestamp", async () => {
        const { log } = await loadProd();
        log.info("hello");

        const ts = jsonLine(stdout).timestamp as string;
        expect(new Date(ts).toISOString()).toBe(ts);
    });

    it("routes errors to stderr, not stdout", async () => {
        const { log } = await loadProd();
        log.error("bad");

        expect(stdout).not.toHaveBeenCalled();
        expect(jsonLine(stderr)).toMatchObject({ level: "error", message: "bad" });
    });

    it("routes warnings to stdout", async () => {
        const { log } = await loadProd();
        log.warn("careful");

        expect(stderr).not.toHaveBeenCalled();
        expect(jsonLine(stdout).level).toBe("warn");
    });

    it("puts the stack last so the readable fields come first", async () => {
        const { log } = await loadProd();
        log.error("boom", { stack: "Error: boom", extra: 1 });

        const keys = Object.keys(jsonLine(stderr));
        expect(keys.at(-1)).toBe("stack");
    });

    it("omits the stack key entirely when there is none", async () => {
        const { log } = await loadProd();
        log.info("hello");

        expect(jsonLine(stdout)).not.toHaveProperty("stack");
    });
});

describe("correlation context", () => {
    it("is absent outside a context", async () => {
        const mod = await loadProd();
        expect(mod.currentLogContext()).toBeUndefined();

        mod.log.info("hello");
        expect(jsonLine(stdout)).not.toHaveProperty("correlationId");
    });

    it("tags entries emitted inside the context", async () => {
        const mod = await loadProd();

        mod.runWithLogContext({ correlationId: "cid-1", userId: "u1" }, () => {
            mod.log.info("hello");
        });

        expect(jsonLine(stdout)).toMatchObject({ correlationId: "cid-1", userId: "u1" });
    });

    it("exposes the active context", async () => {
        const mod = await loadProd();

        const seen = mod.runWithLogContext(
            { correlationId: "cid-1" },
            () => mod.currentLogContext(),
        );

        expect(seen).toEqual({ correlationId: "cid-1" });
    });

    it("propagates across an await boundary", async () => {
        const mod = await loadProd();

        await mod.runWithLogContext({ correlationId: "cid-async" }, async () => {
            await Promise.resolve();
            mod.log.info("nested");
        });

        expect(jsonLine(stdout).correlationId).toBe("cid-async");
    });

    it("does not leak out of the context", async () => {
        const mod = await loadProd();
        mod.runWithLogContext({ correlationId: "cid-1" }, () => { });

        mod.log.info("after");
        expect(jsonLine(stdout)).not.toHaveProperty("correlationId");
    });

    it("lets an explicit extra override the ambient id", async () => {
        const mod = await loadProd();

        mod.runWithLogContext({ correlationId: "ambient" }, () => {
            mod.log.info("hello", { correlationId: "explicit" });
        });

        expect(jsonLine(stdout).correlationId).toBe("explicit");
    });

    it("returns the callback's value", async () => {
        const mod = await loadProd();
        expect(mod.runWithLogContext({ correlationId: "c" }, () => 42)).toBe(42);
    });
});

describe("getCorrelationId", () => {
    it("reuses the inbound header", async () => {
        const mod = await loadProd();
        headersMock.mockResolvedValue({ get: () => "inbound-cid" });

        await expect(mod.getCorrelationId()).resolves.toBe("inbound-cid");
    });

    it("mints a uuid when the header is absent", async () => {
        const mod = await loadProd();
        headersMock.mockResolvedValue({ get: () => null });

        await expect(mod.getCorrelationId()).resolves.toMatch(UUID);
    });

    it("mints a uuid outside a request scope, where headers() throws", async () => {
        const mod = await loadProd();
        headersMock.mockRejectedValue(new Error("called outside a request scope"));

        await expect(mod.getCorrelationId()).resolves.toMatch(UUID);
    });

    it("asks for the x-correlation-id header by name", async () => {
        const mod = await loadProd();
        const get = vi.fn(() => "cid");
        headersMock.mockResolvedValue({ get });

        await mod.getCorrelationId();

        expect(get).toHaveBeenCalledWith("x-correlation-id");
    });
});

describe("createLogger", () => {
    it("stamps every entry with the supplied id", async () => {
        const { createLogger } = await loadProd();
        const logger = createLogger("cid-fixed");

        logger.info("a");
        logger.error("b");

        expect(jsonLine(stdout).correlationId).toBe("cid-fixed");
        expect(jsonLine(stderr).correlationId).toBe("cid-fixed");
    });

    it("mints its own id when none is given and exposes it", async () => {
        const { createLogger } = await loadProd();
        const logger = createLogger();

        expect(logger.correlationId).toMatch(UUID);

        logger.info("a");
        expect(jsonLine(stdout).correlationId).toBe(logger.correlationId);
    });

    it("respects the level floor", async () => {
        const { createLogger } = await loadProd();
        createLogger("c").debug("hidden");
        expect(stdout).not.toHaveBeenCalled();
    });

    it("merges extras into the entry", async () => {
        const { createLogger } = await loadProd();
        createLogger("c").warn("careful", { moduleId: "shop" });

        expect(jsonLine(stdout)).toMatchObject({ level: "warn", moduleId: "shop" });
    });

    it("ignores the ambient context in favour of its own id", async () => {
        const mod = await loadProd();

        mod.runWithLogContext({ correlationId: "ambient" }, () => {
            mod.createLogger("own").info("hello");
        });

        expect(jsonLine(stdout).correlationId).toBe("own");
    });
});

describe("logRequest", () => {
    it("emits request_start immediately", async () => {
        const { logRequest } = await loadProd();
        logRequest("GET", "/api/x", "cid-1");

        expect(jsonLine(stdout)).toMatchObject({
            level: "info",
            message: "request_start",
            method: "GET",
            path: "/api/x",
            correlationId: "cid-1",
        });
    });

    it("mints a correlation id when none is supplied", async () => {
        const { logRequest } = await loadProd();
        const req = logRequest("GET", "/api/x");

        expect(req.correlationId).toMatch(UUID);
        expect(jsonLine(stdout).correlationId).toBe(req.correlationId);
    });

    it("emits request_end with the status and a duration", async () => {
        vi.useFakeTimers();
        try {
            const { logRequest } = await loadProd();
            const req = logRequest("GET", "/api/x", "cid-1");
            vi.advanceTimersByTime(25);
            req.finish(200);

            expect(jsonLine(stdout, 1)).toMatchObject({
                message: "request_end",
                statusCode: 200,
                durationMs: 25,
                level: "info",
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it("logs a 4xx as a warning", async () => {
        const { logRequest } = await loadProd();
        logRequest("GET", "/api/x", "c").finish(404);

        expect(jsonLine(stdout, 1).level).toBe("warn");
    });

    it("logs a 5xx as an error, on stderr", async () => {
        const { logRequest } = await loadProd();
        logRequest("GET", "/api/x", "c").finish(500);

        expect(jsonLine(stderr).level).toBe("error");
    });

    it("treats a 399 as success and a 400 as a warning", async () => {
        const { logRequest } = await loadProd();
        logRequest("GET", "/a", "c").finish(399);
        logRequest("GET", "/b", "c").finish(400);

        expect(jsonLine(stdout, 1).level).toBe("info");
        expect(jsonLine(stdout, 3).level).toBe("warn");
    });

    it("merges extras supplied at finish time", async () => {
        const { logRequest } = await loadProd();
        logRequest("POST", "/api/x", "c").finish(201, { userId: "u1" });

        expect(jsonLine(stdout, 1)).toMatchObject({ userId: "u1", statusCode: 201 });
    });
});

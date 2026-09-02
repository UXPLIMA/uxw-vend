import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * redis.ts sat at 9.8% while backing every cache read in the product. The
 * part that matters is not the happy path but the fallback: when Redis
 * disappears mid-request the helpers are supposed to degrade to the
 * in-memory Map rather than throw, and the `failed` latch is supposed to
 * stop the process from re-dialling a dead server on every single call.
 * Nothing verified either, so a regression that turned a cache outage into
 * a site outage would have shipped silently.
 *
 * Like install-lock, this module reaches its driver through
 * `eval("require")("redis")` so Turbopack never bundles it. That bypasses
 * the ESM mock graph, so the stub is installed on the real CJS module
 * object and restored afterwards. Module scope also holds the client, the
 * `failed` latch, REDIS_URL and the Map, so every test re-imports after
 * `vi.resetModules()`.
 */

type RedisModule = typeof import("@/core/lib/redis");

interface FakeClientBehaviour {
    /** connect() rejects. */
    connectThrows: boolean;
    /** connect() never settles, so `connecting` stays latched. */
    connectHangs: boolean;
    /** get/set/del reject, exercising the per-call fallback. */
    opsThrow: boolean;
}

class FakeRedis {
    isOpen = false;
    store = new Map<string, string>();
    setCalls: Array<[string, string, unknown]> = [];
    delCalls: Array<string | string[]> = [];
    getCalls: string[] = [];
    handlers = new Map<string, (...args: unknown[]) => void>();

    constructor(
        readonly url: string | undefined,
        private readonly behaviour: FakeClientBehaviour,
    ) { }

    on(event: string, listener: (...args: unknown[]) => void): void {
        this.handlers.set(event, listener);
    }

    /** Fire the client's own "error" handler the way node-redis would. */
    emitError(message: string): void {
        this.handlers.get("error")?.(new Error(message));
    }

    async connect(): Promise<void> {
        if (this.behaviour.connectHangs) return new Promise<void>(() => { });
        if (this.behaviour.connectThrows) throw new Error("ECONNREFUSED 127.0.0.1:6379");
        this.isOpen = true;
    }

    async disconnect(): Promise<void> { this.isOpen = false; }
    async ping(): Promise<string> { return "PONG"; }

    async get(key: string): Promise<string | null> {
        this.getCalls.push(key);
        if (this.behaviour.opsThrow) throw new Error("connection lost");
        return this.store.get(key) ?? null;
    }

    async set(key: string, value: string, options?: unknown): Promise<unknown> {
        this.setCalls.push([key, value, options]);
        if (this.behaviour.opsThrow) throw new Error("connection lost");
        this.store.set(key, value);
        return "OK";
    }

    async del(keys: string | string[]): Promise<number> {
        this.delCalls.push(keys);
        if (this.behaviour.opsThrow) throw new Error("connection lost");
        const list = Array.isArray(keys) ? keys : [keys];
        let n = 0;
        for (const k of list) if (this.store.delete(k)) n++;
        return n;
    }
}

let behaviour: FakeClientBehaviour;
/** Every client the module has constructed, in order. */
let clients: FakeRedis[];
let realCreateClient: unknown;

beforeEach(() => {
    behaviour = { connectThrows: false, connectHangs: false, opsThrow: false };
    clients = [];

    // The module resolves `redis` through the CJS registry, not the ESM
    // graph, so the stub has to be installed there. The `eval("require")`
    // mirrors the production module's own deliberate use of it and
    // evaluates a fixed literal, never external input.
    const redisModule = eval("require")("redis");
    realCreateClient = redisModule.createClient;
    redisModule.createClient = (opts: { url?: string }) => {
        const c = new FakeRedis(opts?.url, behaviour);
        clients.push(c);
        return c;
    };

    vi.spyOn(console, "error").mockImplementation(() => { });
    // The module arms a 60s cleanup interval at import; fake timers keep it
    // from outliving the test and make the expiry sweep observable.
    vi.useFakeTimers();
    vi.resetModules();
});

afterEach(() => {
    eval("require")("redis").createClient = realCreateClient;
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

/** REDIS_URL is read at module scope, so it must be set before the import. */
async function load(url?: string): Promise<RedisModule> {
    vi.stubEnv("REDIS_URL", url ?? "");
    vi.resetModules();
    return (await import("@/core/lib/redis")) as RedisModule;
}

const withRedis = () => load("redis://localhost:6379");

// ===========================================================================

describe("isRedisConfigured", () => {
    it("is false when REDIS_URL is unset", async () => {
        const mod = await load();
        expect(mod.isRedisConfigured()).toBe(false);
    });

    it("is true when REDIS_URL is set", async () => {
        const mod = await withRedis();
        expect(mod.isRedisConfigured()).toBe(true);
    });
});

describe("getRedisClient", () => {
    it("returns null and never dials when Redis is not configured", async () => {
        const mod = await load();

        expect(await mod.getRedisClient()).toBeNull();
        expect(clients).toHaveLength(0);
    });

    it("connects once and reuses the open client", async () => {
        const mod = await withRedis();

        const first = await mod.getRedisClient();
        const second = await mod.getRedisClient();

        expect(first).not.toBeNull();
        expect(second).toBe(first);
        expect(clients).toHaveLength(1);
        expect(clients[0]!.url).toBe("redis://localhost:6379");
    });

    it("reconnects when the memoised client has closed", async () => {
        const mod = await withRedis();
        await mod.getRedisClient();
        clients[0]!.isOpen = false;

        await mod.getRedisClient();

        expect(clients).toHaveLength(2);
    });

    it("returns null to a caller that races an in-flight connect", async () => {
        behaviour.connectHangs = true;
        const mod = await withRedis();

        const pending = mod.getRedisClient();
        // The second caller must not queue a second dial.
        expect(await mod.getRedisClient()).toBeNull();
        expect(clients).toHaveLength(1);
        void pending;
    });

    it("falls back to null when the connection is refused", async () => {
        behaviour.connectThrows = true;
        const mod = await withRedis();

        expect(await mod.getRedisClient()).toBeNull();
        expect(console.error).toHaveBeenCalledWith(
            "[Redis] Connection failed, falling back to in-memory:",
            "ECONNREFUSED 127.0.0.1:6379",
        );
    });

    it("latches the failure so a dead server is not re-dialled per call", async () => {
        behaviour.connectThrows = true;
        const mod = await withRedis();

        await mod.getRedisClient();
        await mod.getRedisClient();
        await mod.getRedisClient();

        expect(clients).toHaveLength(1);
    });

    it("lifts the latch and retries after 30 seconds", async () => {
        behaviour.connectThrows = true;
        const mod = await withRedis();
        await mod.getRedisClient();

        behaviour.connectThrows = false;
        await vi.advanceTimersByTimeAsync(30_000);

        expect(await mod.getRedisClient()).not.toBeNull();
        expect(clients).toHaveLength(2);
    });

    it("drops the client and latches when the driver emits an error", async () => {
        const mod = await withRedis();
        await mod.getRedisClient();

        clients[0]!.emitError("read ECONNRESET");

        expect(await mod.getRedisClient()).toBeNull();
        expect(console.error).toHaveBeenCalledWith(
            "[Redis] Connection failed, falling back to in-memory:",
            "read ECONNRESET",
        );
    });

    it("survives an error event carrying no error object", async () => {
        const mod = await withRedis();
        await mod.getRedisClient();

        clients[0]!.handlers.get("error")!();

        expect(console.error).toHaveBeenCalledWith(
            "[Redis] Connection failed, falling back to in-memory:",
            "unknown error",
        );
    });

    it("recovers 30 seconds after a driver error", async () => {
        const mod = await withRedis();
        await mod.getRedisClient();
        clients[0]!.emitError("read ECONNRESET");

        await vi.advanceTimersByTimeAsync(30_000);

        expect(await mod.getRedisClient()).not.toBeNull();
    });
});

// ===========================================================================
// Cache helpers against Redis
// ===========================================================================

describe("cache helpers with Redis available", () => {
    it("reads through to Redis", async () => {
        const mod = await withRedis();
        await mod.cacheSet("k", "v");

        expect(await mod.cacheGet("k")).toBe("v");
        expect(clients[0]!.getCalls).toContain("k");
    });

    it("returns null for a key Redis does not hold", async () => {
        const mod = await withRedis();
        expect(await mod.cacheGet("missing")).toBeNull();
    });

    it("sets without options when no ttl is given", async () => {
        const mod = await withRedis();
        await mod.cacheSet("k", "v");
        expect(clients[0]!.setCalls[0]).toEqual(["k", "v", undefined]);
    });

    it("translates a ttl into an EX option", async () => {
        const mod = await withRedis();
        await mod.cacheSet("k", "v", 90);
        expect(clients[0]!.setCalls[0]).toEqual(["k", "v", { EX: 90 }]);
    });

    it("treats a zero ttl as no expiry rather than an immediate one", async () => {
        const mod = await withRedis();
        await mod.cacheSet("k", "v", 0);
        expect(clients[0]!.setCalls[0]![2]).toBeUndefined();
    });

    it("deletes several keys in one round trip", async () => {
        const mod = await withRedis();
        await mod.cacheSet("a", "1");
        await mod.cacheSet("b", "2");

        await mod.cacheDel("a", "b");

        expect(clients[0]!.delCalls[0]).toEqual(["a", "b"]);
        expect(await mod.cacheGet("a")).toBeNull();
    });

    it("deletes nothing when given no keys", async () => {
        const mod = await withRedis();
        await mod.cacheDel();
        expect(clients[0]!.delCalls[0]).toEqual([]);
    });
});

// ===========================================================================
// Fallback behaviour — the point of the module
// ===========================================================================

describe("in-memory fallback", () => {
    it("stores and reads without Redis configured", async () => {
        const mod = await load();

        await mod.cacheSet("k", "v");

        expect(await mod.cacheGet("k")).toBe("v");
        expect(clients).toHaveLength(0);
    });

    it("expires an entry once its ttl has passed", async () => {
        const mod = await load();
        await mod.cacheSet("k", "v", 60);

        expect(await mod.cacheGet("k")).toBe("v");
        vi.setSystemTime(Date.now() + 61_000);

        expect(await mod.cacheGet("k")).toBeNull();
    });

    it("keeps an entry with no ttl indefinitely", async () => {
        const mod = await load();
        await mod.cacheSet("k", "v");

        vi.setSystemTime(Date.now() + 86_400_000);

        expect(await mod.cacheGet("k")).toBe("v");
    });

    it("sweeps expired entries on the cleanup interval", async () => {
        const mod = await load();
        await mod.cacheSet("short", "v", 10);
        await mod.cacheSet("long", "v", 3600);

        vi.setSystemTime(Date.now() + 61_000);
        await vi.advanceTimersByTimeAsync(60_000);

        expect(await mod.cacheGet("short")).toBeNull();
        expect(await mod.cacheGet("long")).toBe("v");
    });

    it("deletes keys from the memory store", async () => {
        const mod = await load();
        await mod.cacheSet("a", "1");
        await mod.cacheSet("b", "2");

        await mod.cacheDel("a", "b");

        expect(await mod.cacheGet("a")).toBeNull();
        expect(await mod.cacheGet("b")).toBeNull();
    });

    it("falls back to memory when a Redis read throws mid-request", async () => {
        const mod = await withRedis();
        await mod.getRedisClient();
        behaviour.opsThrow = true;

        // The write falls through to memory, and so does the read.
        await mod.cacheSet("k", "v");
        expect(await mod.cacheGet("k")).toBe("v");
    });

    it("falls back to memory when a Redis delete throws", async () => {
        const mod = await withRedis();
        behaviour.opsThrow = true;
        await mod.cacheSet("k", "v");

        await mod.cacheDel("k");

        expect(await mod.cacheGet("k")).toBeNull();
    });

    it("never lets a Redis outage surface as a thrown error", async () => {
        const mod = await withRedis();
        behaviour.opsThrow = true;

        await expect(mod.cacheSet("k", "v")).resolves.toBeUndefined();
        await expect(mod.cacheGet("k")).resolves.toBe("v");
        await expect(mod.cacheDel("k")).resolves.toBeUndefined();
    });
});

// ===========================================================================
// JSON helpers
// ===========================================================================

describe("JSON helpers", () => {
    it("round-trips an object", async () => {
        const mod = await load();
        await mod.cacheSetJSON("k", { a: 1, b: ["x"] });

        expect(await mod.cacheGetJSON<{ a: number; b: string[] }>("k"))
            .toEqual({ a: 1, b: ["x"] });
    });

    it("returns null for a missing key", async () => {
        const mod = await load();
        expect(await mod.cacheGetJSON("nope")).toBeNull();
    });

    it("returns null rather than throwing on corrupt json", async () => {
        const mod = await load();
        await mod.cacheSet("k", "{not json");

        expect(await mod.cacheGetJSON("k")).toBeNull();
    });

    it("passes the ttl through to the underlying set", async () => {
        const mod = await withRedis();
        await mod.cacheSetJSON("k", { a: 1 }, 120);

        expect(clients[0]!.setCalls[0]).toEqual(["k", '{"a":1}', { EX: 120 }]);
    });

    it("treats a cached empty string as absent", async () => {
        const mod = await load();
        await mod.cacheSet("k", "");

        expect(await mod.cacheGetJSON("k")).toBeNull();
    });
});

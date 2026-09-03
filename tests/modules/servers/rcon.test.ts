// @vitest-environment node
/**
 * RCON configuration used to live in two places at once: per-server columns on
 * GameServer, and a global rcon_host / rcon_port / rcon_password trio in the
 * settings table that held the password in plaintext and could only ever
 * describe one server. Two modules then carried their own copy of the client,
 * and the copies had already drifted.
 *
 * There is one implementation now, it reads per-server configuration, and it
 * migrates the old settings on first use. These are the rules that matter.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

interface ServerRow {
    id: string;
    name: string;
    host: string;
    rconPort: number | null;
    rconPassword: string | null;
    isActive: boolean;
    isDefault: boolean;
    order: number;
    createdAt: Date;
}

const db = { servers: [] as ServerRow[], settings: [] as { key: string; value: string }[], nextId: 1 };

function matches(row: ServerRow, where: Record<string, unknown>): boolean {
    if (where.isActive !== undefined && row.isActive !== where.isActive) return false;
    if (where.host !== undefined && row.host !== where.host) return false;
    if (where.rconPort && row.rconPort === null) return false;
    if (where.rconPassword && row.rconPassword === null) return false;
    return true;
}

const prismaMock = {
    gameServer: {
        findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
            db.servers.find((s) => s.id === where.id) ?? null,
        ),
        findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
            db.servers.find((s) => matches(s, where ?? {})) ?? null,
        ),
        findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) =>
            db.servers
                .filter((s) => matches(s, where ?? {}))
                .sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.order - b.order),
        ),
        count: vi.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
            db.servers.filter((s) => matches(s, where ?? {})).length,
        ),
        create: vi.fn(async ({ data }: { data: Partial<ServerRow> }) => {
            const row: ServerRow = {
                id: `s${db.nextId++}`,
                name: data.name ?? "",
                host: data.host ?? "",
                rconPort: data.rconPort ?? null,
                rconPassword: data.rconPassword ?? null,
                isActive: true,
                isDefault: data.isDefault ?? false,
                order: 0,
                createdAt: new Date(),
            };
            db.servers.push(row);
            return row;
        }),
        update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<ServerRow> }) => {
            const row = db.servers.find((s) => s.id === where.id)!;
            Object.assign(row, data);
            return row;
        }),
    },
    setting: {
        findMany: vi.fn(async () => db.settings),
        deleteMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) => {
            db.settings = db.settings.filter((s) => !where.key.in.includes(s.key));
            return { count: 0 };
        }),
    },
};

const connect = vi.fn();

vi.mock("@/core/sdk/server", () => ({
    prisma: prismaMock,
    // The store wrote these through secret-storage; the stand-in keeps the
    // round trip visible without pulling in real crypto.
    encryptSecret: (v: string) => `enc(${v})`,
    decryptSecret: (v: string) => (v.startsWith("enc(") ? v.slice(4, -1) : v),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function server(overrides: Partial<ServerRow> = {}): ServerRow {
    return {
        id: `s${db.nextId++}`,
        name: "Survival",
        host: "play.example.com",
        rconPort: 25575,
        rconPassword: "enc(hunter2)",
        isActive: true,
        isDefault: false,
        order: 0,
        createdAt: new Date(),
        ...overrides,
    };
}

// The module keeps its one-time migration in a module-level promise, so each
// test needs a fresh copy of it.
async function freshRcon() {
    vi.resetModules();
    return await import("@/modules/servers/lib/rcon");
}

beforeEach(() => {
    db.servers = [];
    db.settings = [];
    db.nextId = 1;
    connect.mockReset();
    // Call counts only, not implementations - the prisma stand-in has to keep
    // working, but "how many times did this run" has to start from zero.
    vi.clearAllMocks();
});

describe("resolveRconConfig", () => {
    it("reads the named server's own credentials", async () => {
        const row = server();
        db.servers.push(row);
        const { resolveRconConfig } = await freshRcon();
        await expect(resolveRconConfig(row.id)).resolves.toEqual({
            host: "play.example.com",
            port: 25575,
            password: "hunter2",
        });
    });

    // A delivery command aimed at the survival server must never end up on the
    // creative one because survival happened to be misconfigured.
    it("does not fall back to another server when the named one has no RCON", async () => {
        const target = server({ name: "Survival", rconPort: null, rconPassword: null });
        db.servers.push(target, server({ name: "Creative", isDefault: true }));
        const { resolveRconConfig } = await freshRcon();
        await expect(resolveRconConfig(target.id)).resolves.toBeNull();
    });

    it("refuses a server that has been deactivated", async () => {
        const row = server({ isActive: false });
        db.servers.push(row);
        const { resolveRconConfig } = await freshRcon();
        await expect(resolveRconConfig(row.id)).resolves.toBeNull();
    });

    it("uses the default server when the caller names none", async () => {
        db.servers.push(
            server({ name: "Creative", host: "creative.example.com" }),
            server({ name: "Survival", host: "survival.example.com", isDefault: true }),
        );
        const { resolveRconConfig } = await freshRcon();
        await expect(resolveRconConfig()).resolves.toMatchObject({ host: "survival.example.com" });
    });

    it("returns nothing when no server has RCON at all", async () => {
        db.servers.push(server({ rconPort: null, rconPassword: null }));
        const { resolveRconConfig, isRconAvailable } = await freshRcon();
        await expect(resolveRconConfig()).resolves.toBeNull();
        await expect(isRconAvailable()).resolves.toBe(false);
    });

    it("reads a password written before it was encrypted", async () => {
        const row = server({ rconPassword: "plaintext-from-an-old-install" });
        db.servers.push(row);
        const { resolveRconConfig } = await freshRcon();
        await expect(resolveRconConfig(row.id)).resolves.toMatchObject({
            password: "plaintext-from-an-old-install",
        });
    });
});

describe("migrating the old global settings", () => {
    it("turns them into a server row with an encrypted password", async () => {
        db.settings.push(
            { key: "rcon_host", value: "old.example.com" },
            { key: "rcon_port", value: "27015" },
            { key: "rcon_password", value: "hunter2" },
        );
        const { resolveRconConfig } = await freshRcon();

        await expect(resolveRconConfig()).resolves.toEqual({
            host: "old.example.com",
            port: 27015,
            password: "hunter2",
        });
        expect(db.servers[0].rconPassword).toBe("enc(hunter2)");
    });

    // Leaving the row behind would leave a plaintext password in a table that
    // has no reason to hold one.
    it("deletes the settings once they have been moved", async () => {
        db.settings.push(
            { key: "rcon_host", value: "old.example.com" },
            { key: "rcon_password", value: "hunter2" },
        );
        const { resolveRconConfig } = await freshRcon();
        await resolveRconConfig();
        expect(db.settings).toEqual([]);
    });

    it("drops a half-configured leftover instead of creating a broken server", async () => {
        db.settings.push({ key: "rcon_host", value: "old.example.com" });
        const { resolveRconConfig } = await freshRcon();
        await expect(resolveRconConfig()).resolves.toBeNull();
        expect(db.servers).toEqual([]);
        expect(db.settings).toEqual([]);
    });

    it("attaches them to a server that already describes the same host", async () => {
        db.servers.push(server({ host: "old.example.com", rconPort: null, rconPassword: null }));
        db.settings.push(
            { key: "rcon_host", value: "old.example.com" },
            { key: "rcon_password", value: "hunter2" },
        );
        const { resolveRconConfig } = await freshRcon();
        await resolveRconConfig();
        expect(db.servers).toHaveLength(1);
        expect(db.servers[0].rconPassword).toBe("enc(hunter2)");
    });

    it("runs once, not on every command", async () => {
        db.settings.push(
            { key: "rcon_host", value: "old.example.com" },
            { key: "rcon_password", value: "hunter2" },
        );
        const { resolveRconConfig } = await freshRcon();
        await resolveRconConfig();
        await resolveRconConfig();
        await resolveRconConfig();
        expect(prismaMock.setting.findMany).toHaveBeenCalledTimes(1);
        expect(db.servers).toHaveLength(1);
    });
});

describe("sendRconCommand", () => {
    it("explains which kind of misconfiguration it hit", async () => {
        const { sendRconCommand } = await freshRcon();
        await expect(sendRconCommand("say hi")).rejects.toThrow(/No server on this install/);

        db.servers.push(server({ id: "s-known", rconPort: null, rconPassword: null }));
        const fresh = await freshRcon();
        await expect(fresh.sendRconCommand("say hi", "s-known")).rejects.toThrow(/no RCON port and password/);
    });
});

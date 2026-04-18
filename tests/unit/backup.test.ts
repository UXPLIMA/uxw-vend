import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "path";

// Mock fs/promises so listBackups/deleteBackup/getBackupPath don't hit disk.
// Typed as (...args: unknown[]) so TypeScript won't try to widen the vi.fn
// signature to the real fs/promises overloads.
const mkdir = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined);
const readdir = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const stat = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const unlink = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => undefined);
const readFile = vi.fn<(...args: unknown[]) => Promise<string>>(async () => "");

vi.mock("fs/promises", () => ({
    default: {
        mkdir,
        readdir,
        stat,
        unlink,
        readFile,
        writeFile: async () => undefined,
        access: async () => undefined,
    },
    mkdir,
    readdir,
    stat,
    unlink,
    readFile,
    writeFile: async () => undefined,
    access: async () => undefined,
}));

type BackupModule = typeof import("@/core/lib/backup");
let mod: BackupModule;

const BACKUP_DIR = path.resolve(process.cwd(), "backups");

function makeStat(overrides: Partial<{ size: number; birthtime: Date; mtime: Date; isFile: boolean }> = {}) {
    return {
        size: overrides.size ?? 1234,
        birthtime: overrides.birthtime ?? new Date("2026-01-01T00:00:00Z"),
        mtime: overrides.mtime ?? new Date("2026-01-01T00:00:00Z"),
        isFile: () => overrides.isFile ?? true,
    };
}

beforeEach(async () => {
    vi.resetModules();
    mkdir.mockClear();
    readdir.mockReset();
    stat.mockReset();
    unlink.mockReset();
    readFile.mockReset();
    readFile.mockResolvedValue("");
    mod = await import("@/core/lib/backup");
});

describe("backup: formatBytes", () => {
    it("returns '0 B' for zero or negative", () => {
        expect(mod.formatBytes(0)).toBe("0 B");
        expect(mod.formatBytes(-5)).toBe("0 B");
    });

    it("returns '0 B' for non-finite input", () => {
        expect(mod.formatBytes(NaN)).toBe("0 B");
        expect(mod.formatBytes(Infinity)).toBe("0 B");
    });

    it("formats bytes in the B range with no decimal", () => {
        expect(mod.formatBytes(500)).toBe("500 B");
    });

    it("formats kilobytes with one decimal", () => {
        expect(mod.formatBytes(1024)).toBe("1.0 KB");
        expect(mod.formatBytes(2048)).toBe("2.0 KB");
        expect(mod.formatBytes(1536)).toBe("1.5 KB");
    });

    it("formats megabytes", () => {
        expect(mod.formatBytes(1024 * 1024)).toBe("1.0 MB");
        expect(mod.formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    });

    it("formats gigabytes", () => {
        expect(mod.formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.0 GB");
    });

    it("caps at TB", () => {
        const huge = 5 * 1024 * 1024 * 1024 * 1024;
        expect(mod.formatBytes(huge)).toBe("5.0 TB");
    });
});

describe("backup: listBackups", () => {
    it("returns empty array for empty directory", async () => {
        readdir.mockResolvedValue([]);
        const list = await mod.listBackups();
        expect(list).toEqual([]);
    });

    it("parses matching filenames and ignores non-matching ones", async () => {
        readdir.mockResolvedValue([
            "uxwvend-manual-2026-01-01T00-00-00-000Z.sql.gz",
            "random-file.txt",
            "uxwvend-scheduled-2026-02-01T00-00-00-000Z.sql.gz",
        ]);
        stat.mockImplementation(async () =>
            makeStat({ size: 1000, birthtime: new Date("2026-01-01") }),
        );

        const list = await mod.listBackups();
        expect(list).toHaveLength(2);
        const ids = list.map((b) => b.id);
        expect(ids).toContain("uxwvend-manual-2026-01-01T00-00-00-000Z");
        expect(ids).toContain("uxwvend-scheduled-2026-02-01T00-00-00-000Z");
    });

    it("sorts results newest first", async () => {
        readdir.mockResolvedValue([
            "uxwvend-manual-2026-01-01T00-00-00-000Z.sql.gz",
            "uxwvend-manual-2026-03-01T00-00-00-000Z.sql.gz",
            "uxwvend-manual-2026-02-01T00-00-00-000Z.sql.gz",
        ]);
        const dateMap: Record<string, Date> = {
            "uxwvend-manual-2026-01-01T00-00-00-000Z.sql.gz": new Date("2026-01-01"),
            "uxwvend-manual-2026-02-01T00-00-00-000Z.sql.gz": new Date("2026-02-01"),
            "uxwvend-manual-2026-03-01T00-00-00-000Z.sql.gz": new Date("2026-03-01"),
        };
        stat.mockImplementation(async (...args: unknown[]) => {
            const filename = path.basename(args[0] as string);
            return makeStat({ birthtime: dateMap[filename] });
        });

        const list = await mod.listBackups();
        expect(list[0].id).toContain("2026-03-01");
        expect(list[1].id).toContain("2026-02-01");
        expect(list[2].id).toContain("2026-01-01");
    });

    it("skips non-file entries", async () => {
        readdir.mockResolvedValue([
            "uxwvend-manual-2026-01-01T00-00-00-000Z.sql.gz",
        ]);
        stat.mockResolvedValue(makeStat({ isFile: false }));
        const list = await mod.listBackups();
        expect(list).toEqual([]);
    });

    it("reports sizeBytes and type from filename", async () => {
        readdir.mockResolvedValue([
            "uxwvend-scheduled-2026-01-01T00-00-00-000Z.sql.gz",
        ]);
        stat.mockResolvedValue(makeStat({ size: 4096 }));
        const list = await mod.listBackups();
        expect(list[0].sizeBytes).toBe(4096);
        expect(list[0].type).toBe("scheduled");
    });
});

describe("backup: deleteBackup path-traversal protection", () => {
    it("rejects id with path traversal (..)", async () => {
        readdir.mockResolvedValue([]);
        await mod.deleteBackup("../etc/passwd");
        expect(unlink).not.toHaveBeenCalled();
    });

    it("rejects id with slashes", async () => {
        await mod.deleteBackup("uxwvend-manual-2026/../../evil");
        expect(unlink).not.toHaveBeenCalled();
    });

    it("rejects totally malformed id (no filename match)", async () => {
        await mod.deleteBackup("not-a-real-backup");
        expect(unlink).not.toHaveBeenCalled();
    });

    it("accepts a well-formed id and calls unlink with backup dir path", async () => {
        await mod.deleteBackup("uxwvend-manual-2026-01-01T00-00-00-000Z");
        expect(unlink).toHaveBeenCalled();
        const firstCall = unlink.mock.calls[0] as unknown as [string];
        expect(firstCall[0]).toBeTypeOf("string");
        expect(firstCall[0].startsWith(BACKUP_DIR)).toBe(true);
    });
});

describe("backup: getBackupPath", () => {
    it("returns null for an invalid id", async () => {
        const p = await mod.getBackupPath("../etc/passwd");
        expect(p).toBeNull();
    });

    it("returns null when file does not exist (stat throws)", async () => {
        stat.mockRejectedValue(new Error("ENOENT"));
        const p = await mod.getBackupPath("uxwvend-manual-2026-01-01T00-00-00-000Z");
        expect(p).toBeNull();
    });

    it("returns null when the entry is not a file", async () => {
        stat.mockResolvedValue(makeStat({ isFile: false }));
        const p = await mod.getBackupPath("uxwvend-manual-2026-01-01T00-00-00-000Z");
        expect(p).toBeNull();
    });

    it("returns a path under BACKUP_DIR for a valid id and existing file", async () => {
        stat.mockResolvedValue(makeStat({ isFile: true }));
        const p = await mod.getBackupPath("uxwvend-manual-2026-01-01T00-00-00-000Z");
        expect(p).not.toBeNull();
        expect((p as string).startsWith(BACKUP_DIR)).toBe(true);
        expect(p).toContain("uxwvend-manual-2026-01-01T00-00-00-000Z.sql.gz");
    });

    it("rejects a valid-looking id containing a traversal sequence", async () => {
        const p = await mod.getBackupPath("uxwvend-manual-../evil");
        expect(p).toBeNull();
    });
});

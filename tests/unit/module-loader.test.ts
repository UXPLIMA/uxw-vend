// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * The loader is the boundary between untrusted files on disk and the
 * module registry. A malformed manifest must remove exactly one module,
 * never take the scan down with it — every module after the offender
 * would vanish too, and the failure would look like "my module
 * disappeared" rather than "module X is invalid".
 *
 * It runs in `node` rather than the default jsdom environment on purpose:
 * `scanModules` short-circuits when `window` exists, which is the guard
 * that keeps `fs` out of the client bundle.
 */

type Loader = typeof import("@/core/lib/module-loader");

const VALID = {
    id: "shop",
    name: "Shop",
    description: "A shop module",
    version: "1.0.0",
    coreVersion: "^1.0.0",
};

let root: string;
let cwd: ReturnType<typeof vi.spyOn>;
let consoleWarn: ReturnType<typeof vi.spyOn>;
let consoleError: ReturnType<typeof vi.spyOn>;

/** Write `src/modules/<dir>/module.json` under the fake project root. */
function writeModule(dir: string, manifest: unknown): void {
    const target = path.join(root, "src/modules", dir);
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(
        path.join(target, "module.json"),
        typeof manifest === "string" ? manifest : JSON.stringify(manifest),
    );
}

function mkdir(...segments: string[]): void {
    fs.mkdirSync(path.join(root, ...segments), { recursive: true });
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "uxwvend-loader-"));
    cwd = vi.spyOn(process, "cwd").mockReturnValue(root);
    consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => { });
    consoleError = vi.spyOn(console, "error").mockImplementation(() => { });
    vi.spyOn(console, "log").mockImplementation(() => { });
    vi.resetModules();
});

afterEach(() => {
    cwd.mockRestore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fs.rmSync(root, { recursive: true, force: true });
});

/** The loader is a singleton, so each test needs a fresh module instance. */
async function load(): Promise<Loader> {
    return (await import("@/core/lib/module-loader")) as Loader;
}

describe("scanModules", () => {
    it("finds nothing when src/modules does not exist", async () => {
        const { moduleLoader } = await load();
        expect(moduleLoader.scanModules().size).toBe(0);
    });

    it("finds nothing in an empty src/modules", async () => {
        mkdir("src/modules");
        const { moduleLoader } = await load();

        expect(moduleLoader.scanModules().size).toBe(0);
    });

    it("loads a valid manifest", async () => {
        writeModule("shop", VALID);
        const { moduleLoader } = await load();

        const loaded = moduleLoader.scanModules();
        expect(loaded.get("shop")?.manifest.name).toBe("Shop");
    });

    it("records where the module lives on disk", async () => {
        writeModule("shop", VALID);
        const { moduleLoader } = await load();

        expect(moduleLoader.scanModules().get("shop")?.path)
            .toBe(path.join(root, "src/modules", "shop"));
    });

    it("keys by the manifest id, not the directory name", async () => {
        writeModule("some-folder", VALID);
        const { moduleLoader } = await load();

        const loaded = moduleLoader.scanModules();
        expect(loaded.has("shop")).toBe(true);
        expect(loaded.has("some-folder")).toBe(false);
    });

    it("loads several modules in one scan", async () => {
        writeModule("shop", VALID);
        writeModule("blog", { ...VALID, id: "blog", name: "Blog" });
        const { moduleLoader } = await load();

        expect([...moduleLoader.scanModules().keys()].sort()).toEqual(["blog", "shop"]);
    });

    it("ignores a directory with no manifest", async () => {
        mkdir("src/modules", "not-a-module");
        const { moduleLoader } = await load();

        expect(moduleLoader.scanModules().size).toBe(0);
    });

    it("ignores loose files next to the module directories", async () => {
        mkdir("src/modules");
        fs.writeFileSync(path.join(root, "src/modules", "README.md"), "hi");
        writeModule("shop", VALID);
        const { moduleLoader } = await load();

        expect(moduleLoader.scanModules().size).toBe(1);
    });

    it("returns the same map it holds internally", async () => {
        writeModule("shop", VALID);
        const { moduleLoader } = await load();

        expect(moduleLoader.scanModules()).toBe(moduleLoader.scanModules());
    });
});

describe("a bad module does not take down the scan", () => {
    it("skips unparseable JSON and keeps going", async () => {
        writeModule("broken", "{ not json");
        writeModule("shop", VALID);
        const { moduleLoader } = await load();

        const loaded = moduleLoader.scanModules();
        expect(loaded.has("shop")).toBe(true);
        expect(loaded.size).toBe(1);
    });

    it("names the offending directory in the JSON warning", async () => {
        writeModule("broken", "{ not json");
        const { moduleLoader } = await load();
        moduleLoader.scanModules();

        expect(String(consoleWarn.mock.calls[0]![0])).toContain("broken");
        expect(String(consoleWarn.mock.calls[0]![0])).toContain("invalid JSON");
    });

    it("skips a manifest that fails the schema and keeps going", async () => {
        writeModule("bad", { ...VALID, id: "bad", version: "not-semver" });
        writeModule("shop", VALID);
        const { moduleLoader } = await load();

        const loaded = moduleLoader.scanModules();
        expect(loaded.has("shop")).toBe(true);
        expect(loaded.has("bad")).toBe(false);
    });

    it("points at the offending field in the schema warning", async () => {
        writeModule("bad", { ...VALID, version: "not-semver" });
        const { moduleLoader } = await load();
        moduleLoader.scanModules();

        const message = String(consoleWarn.mock.calls[0]![0]);
        expect(message).toContain("bad");
        expect(message).toContain("at version");
    });

    it("rejects a manifest missing the required coreVersion", async () => {
        const { coreVersion: _omitted, ...noRange } = VALID;
        writeModule("shop", noRange);
        const { moduleLoader } = await load();

        expect(moduleLoader.scanModules().size).toBe(0);
    });

    it("reports a schema failure with no field path without saying 'at undefined'", async () => {
        writeModule("bad", ["not", "an", "object"]);
        const { moduleLoader } = await load();
        moduleLoader.scanModules();

        expect(String(consoleWarn.mock.calls[0]![0])).not.toContain("at undefined");
    });

    it("logs an unreadable manifest as an error rather than throwing", async () => {
        const dir = path.join(root, "src/modules", "shop");
        fs.mkdirSync(dir, { recursive: true });
        // A directory where module.json should be: exists, but cannot be read.
        fs.mkdirSync(path.join(dir, "module.json"));
        const { moduleLoader } = await load();

        expect(() => moduleLoader.scanModules()).not.toThrow();
        expect(consoleError).toHaveBeenCalled();
    });
});

describe("lazy initialisation", () => {
    it("scans on the first getModules call", async () => {
        writeModule("shop", VALID);
        const { moduleLoader } = await load();

        expect(moduleLoader.getModules().map((m) => m.manifest.id)).toEqual(["shop"]);
    });

    it("scans on the first getModule call", async () => {
        writeModule("shop", VALID);
        const { moduleLoader } = await load();

        expect(moduleLoader.getModule("shop")?.manifest.id).toBe("shop");
    });

    it("returns undefined for a module that is not installed", async () => {
        writeModule("shop", VALID);
        const { moduleLoader } = await load();

        expect(moduleLoader.getModule("nope")).toBeUndefined();
    });

    it("does not re-scan once initialised", async () => {
        writeModule("shop", VALID);
        const { moduleLoader } = await load();
        moduleLoader.getModules();

        // A module appearing on disk afterwards is invisible until restart —
        // which is exactly why installing one rebuilds and restarts.
        writeModule("blog", { ...VALID, id: "blog" });

        expect(moduleLoader.getModules()).toHaveLength(1);
    });

    it("keeps re-scanning while src/modules is absent", async () => {
        const { moduleLoader } = await load();
        expect(moduleLoader.getModules()).toHaveLength(0);

        // The early return leaves `initialized` false, so a later call sees
        // modules that appear afterwards.
        writeModule("shop", VALID);
        expect(moduleLoader.getModules()).toHaveLength(1);
    });
});

describe("client-side guard", () => {
    it("does no filesystem work when a window exists", async () => {
        writeModule("shop", VALID);
        const { moduleLoader } = await load();
        vi.stubGlobal("window", {});

        // This guard is what keeps `fs` out of the client bundle.
        expect(moduleLoader.scanModules().size).toBe(0);
    });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * moduleSystem answers "is this module on?" from state loaded out of the
 * database. Its fail-closed default is the opposite of module-cache's, and
 * deliberately so: before initialize() has run it knows nothing, and
 * reporting "enabled" then would expose a disabled module's admin surface.
 * getAllPermissions feeds the permission registry, so a module leaking in
 * there while disabled widens the authorization surface.
 */

const { moduleLoader } = vi.hoisted(() => ({
    moduleLoader: { getModules: vi.fn(), getModule: vi.fn() },
}));

vi.mock("@/core/lib/module-loader", () => ({ moduleLoader }));

import { moduleSystem } from "@/core/lib/modules";

interface Manifest {
    id: string;
    permissions?: string[];
    defaultConfig?: Record<string, unknown>;
}

function manifests(...list: Manifest[]) {
    moduleLoader.getModules.mockReturnValue(list.map((manifest) => ({ manifest })));
    moduleLoader.getModule.mockImplementation((id: string) => {
        const found = list.find((m) => m.id === id);
        return found ? { manifest: found } : undefined;
    });
}

const CORE_PERMISSIONS = ["admin.access", "admin.settings", "admin.users", "admin.roles"];

/** ModuleState always carries a config bag, even when it is empty. */
function state(id: string, enabled: boolean, config: Record<string, unknown> = {}) {
    return { id, enabled, config };
}

beforeEach(async () => {
    moduleLoader.getModules.mockReset().mockReturnValue([]);
    moduleLoader.getModule.mockReset().mockReturnValue(undefined);
    // The singleton carries state between tests; clearing it is the only
    // way back to the pre-initialize() state short of re-importing.
    await moduleSystem.initialize([]);
});

describe("definitions", () => {
    it("passes the loader's manifests straight through", () => {
        manifests({ id: "shop" }, { id: "blog" });
        expect(moduleSystem.getDefinitions().map((m) => m.id)).toEqual(["shop", "blog"]);
    });

    it("finds one manifest by id", () => {
        manifests({ id: "shop" });
        expect(moduleSystem.getDefinition("shop")?.id).toBe("shop");
    });

    it("returns undefined for a module that is not installed", () => {
        manifests({ id: "shop" });
        expect(moduleSystem.getDefinition("nope")).toBeUndefined();
    });
});

describe("isEnabled", () => {
    it("reports false before initialize has run", async () => {
        // Re-import to get an uninitialised singleton.
        vi.resetModules();
        const fresh = (await import("@/core/lib/modules")).moduleSystem;

        expect(fresh.isEnabled("shop")).toBe(false);
    });

    it("reports an enabled module", async () => {
        await moduleSystem.initialize([state("shop", true)]);
        expect(moduleSystem.isEnabled("shop")).toBe(true);
    });

    it("reports a disabled module", async () => {
        await moduleSystem.initialize([state("shop", false)]);
        expect(moduleSystem.isEnabled("shop")).toBe(false);
    });

    it("fails closed for a module with no row at all", async () => {
        await moduleSystem.initialize([state("blog", true)]);
        expect(moduleSystem.isEnabled("shop")).toBe(false);
    });

    it("requires enabled to be exactly true, not merely truthy", async () => {
        await moduleSystem.initialize([
            state("shop", 1 as unknown as boolean),
        ]);
        expect(moduleSystem.isEnabled("shop")).toBe(false);
    });

    it("replaces the previous state rather than merging into it", async () => {
        await moduleSystem.initialize([state("shop", true)]);
        await moduleSystem.initialize([state("blog", true)]);

        expect(moduleSystem.isEnabled("shop")).toBe(false);
        expect(moduleSystem.isEnabled("blog")).toBe(true);
    });
});

describe("getConfig", () => {
    it("returns the manifest defaults when nothing is stored", () => {
        manifests({ id: "shop", defaultConfig: { currency: "USD", perPage: 20 } });

        expect(moduleSystem.getConfig("shop")).toEqual({ currency: "USD", perPage: 20 });
    });

    it("lets the stored config override a default", async () => {
        manifests({ id: "shop", defaultConfig: { currency: "USD", perPage: 20 } });
        await moduleSystem.initialize([
            state("shop", true, { currency: "EUR" }),
        ]);

        expect(moduleSystem.getConfig("shop")).toEqual({ currency: "EUR", perPage: 20 });
    });

    it("is an empty object for an unknown module", () => {
        expect(moduleSystem.getConfig("nope")).toEqual({});
    });

    it("returns stored config even for a module with no defaults", async () => {
        manifests({ id: "shop" });
        await moduleSystem.initialize([
            state("shop", true, { a: 1 }),
        ]);

        expect(moduleSystem.getConfig("shop")).toEqual({ a: 1 });
    });
});

describe("getEnabledModules", () => {
    it("filters out the disabled ones", async () => {
        manifests({ id: "shop" }, { id: "blog" });
        await moduleSystem.initialize([
            state("shop", true),
            state("blog", false),
        ]);

        expect(moduleSystem.getEnabledModules().map((m) => m.id)).toEqual(["shop"]);
    });

    it("is empty when nothing is enabled", async () => {
        manifests({ id: "shop" });
        expect(moduleSystem.getEnabledModules()).toEqual([]);
    });
});

describe("getAllPermissions", () => {
    it("always includes the core permissions", () => {
        expect(moduleSystem.getAllPermissions()).toEqual(CORE_PERMISSIONS);
    });

    it("adds the permissions of enabled modules", async () => {
        manifests({ id: "shop", permissions: ["shop.manage", "shop.orders"] });
        await moduleSystem.initialize([state("shop", true)]);

        expect(moduleSystem.getAllPermissions()).toEqual([
            ...CORE_PERMISSIONS, "shop.manage", "shop.orders",
        ]);
    });

    it("never grants a disabled module's permissions", async () => {
        manifests({ id: "shop", permissions: ["shop.manage"] });
        await moduleSystem.initialize([state("shop", false)]);

        expect(moduleSystem.getAllPermissions()).toEqual(CORE_PERMISSIONS);
    });

    it("tolerates a manifest that declares none", async () => {
        manifests({ id: "shop" });
        await moduleSystem.initialize([state("shop", true)]);

        expect(moduleSystem.getAllPermissions()).toEqual(CORE_PERMISSIONS);
    });
});

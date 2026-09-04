import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ModuleSetting } from "@/core/lib/module-types";

/**
 * The two halves of the settings contract.
 *
 * `resolveSettings` repairs: it is reading a bag that may predate the manifest
 * in front of it (a module downgrade, a setting removed in an update, a
 * hand-edited row), and a module reading its own settings must never have to
 * defend against any of that.
 *
 * `validateSettingsInput` reports: an admin form sending an unknown key or the
 * wrong type is a bug, and silently repairing it would store something the
 * admin did not ask for.
 */

const { ModuleSettings } = vi.hoisted(() => ({
    ModuleSettings: {} as Record<string, ModuleSetting[]>,
}));

vi.mock("@/core/generated/module-data", () => ({ ModuleSettings }));

import {
    coerceSetting,
    resolveSettings,
    settingDeclarations,
    settingDefaults,
    validateSettingsInput,
} from "@/core/lib/module-settings";

const FLAG: ModuleSetting = { key: "flag", type: "boolean", default: true, label: "Flag" };
const SIZE: ModuleSetting = { key: "size", type: "number", default: 15, min: 5, max: 100, label: "Size" };
const NOTE: ModuleSetting = { key: "note", type: "string", default: "hi", maxLength: 8, label: "Note" };

beforeEach(() => {
    for (const key of Object.keys(ModuleSettings)) delete ModuleSettings[key];
    ModuleSettings.demo = [FLAG, SIZE, NOTE];
});

describe("settingDeclarations", () => {
    it("is empty for a module that declares nothing", () => {
        expect(settingDeclarations("nope")).toEqual([]);
    });
});

describe("settingDefaults", () => {
    it("is every declared key at its declared default", () => {
        expect(settingDefaults("demo")).toEqual({ flag: true, size: 15, note: "hi" });
    });
});

describe("coerceSetting", () => {
    it("rejects a value of the wrong type", () => {
        expect(coerceSetting(FLAG, "true")).toBeUndefined();
        expect(coerceSetting(SIZE, "20")).toBeUndefined();
        expect(coerceSetting(NOTE, 3)).toBeUndefined();
    });

    it("rejects a number that is not finite", () => {
        expect(coerceSetting(SIZE, NaN)).toBeUndefined();
        expect(coerceSetting(SIZE, Infinity)).toBeUndefined();
    });

    it("clamps a number to its declared bounds rather than dropping it", () => {
        // A module update that tightens `max` should narrow a stored value,
        // not silently snap it back to the default.
        expect(coerceSetting(SIZE, 4000)).toBe(100);
        expect(coerceSetting(SIZE, 1)).toBe(5);
    });

    it("truncates a string to its declared maxLength", () => {
        expect(coerceSetting(NOTE, "0123456789")).toBe("01234567");
    });

    it("passes a value that already fits", () => {
        expect(coerceSetting(FLAG, false)).toBe(false);
        expect(coerceSetting(SIZE, 20)).toBe(20);
        expect(coerceSetting(NOTE, "ok")).toBe("ok");
    });
});

describe("resolveSettings", () => {
    it("is the defaults when nothing is stored", () => {
        expect(resolveSettings("demo", null)).toEqual({ flag: true, size: 15, note: "hi" });
        expect(resolveSettings("demo", undefined)).toEqual({ flag: true, size: 15, note: "hi" });
        expect(resolveSettings("demo", {})).toEqual({ flag: true, size: 15, note: "hi" });
    });

    it("lets a stored value override its default", () => {
        expect(resolveSettings("demo", { flag: false, size: 40 })).toEqual({
            flag: false, size: 40, note: "hi",
        });
    });

    it("falls back to the default for a stored value of the wrong type", () => {
        expect(resolveSettings("demo", { flag: "yes" })).toEqual({ flag: true, size: 15, note: "hi" });
    });

    it("drops a stored key the manifest no longer declares", () => {
        // A module that removed a setting in an update must not see it again.
        expect(resolveSettings("demo", { gone: 1, flag: false })).toEqual({
            flag: false, size: 15, note: "hi",
        });
    });

    it("survives a stored value that is not an object at all", () => {
        expect(resolveSettings("demo", "corrupt")).toEqual({ flag: true, size: 15, note: "hi" });
        expect(resolveSettings("demo", [1, 2])).toEqual({ flag: true, size: 15, note: "hi" });
    });

    it("is empty for a module that declares nothing, whatever is stored", () => {
        expect(resolveSettings("nope", { anything: true })).toEqual({});
    });
});

describe("validateSettingsInput", () => {
    it("accepts nothing at all", () => {
        expect(validateSettingsInput("demo", undefined)).toEqual({ ok: true, value: {} });
        expect(validateSettingsInput("demo", null)).toEqual({ ok: true, value: {} });
    });

    it("accepts a partial submission", () => {
        expect(validateSettingsInput("demo", { flag: false })).toEqual({ ok: true, value: { flag: false } });
    });

    it("refuses an unknown key instead of storing it", () => {
        const result = validateSettingsInput("demo", { flag: true, sneaky: "x" });
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toContain("sneaky");
    });

    it("refuses any key for a module that declares no settings", () => {
        const result = validateSettingsInput("nope", { anything: 1 });
        expect(result.ok).toBe(false);
    });

    it("refuses a value of the wrong type", () => {
        expect(validateSettingsInput("demo", { size: "20" }).ok).toBe(false);
        expect(validateSettingsInput("demo", { flag: 1 }).ok).toBe(false);
    });

    it("refuses a number outside its bounds rather than clamping it", () => {
        // The admin asked for something the module said it cannot do; saying so
        // is more useful than saving a different number.
        const result = validateSettingsInput("demo", { size: 4000 });
        expect(result.ok).toBe(false);
        expect(result.ok === false && result.error).toContain("between 5 and 100");
    });

    it("refuses NaN, which JSON never carries but a form can produce", () => {
        expect(validateSettingsInput("demo", { size: NaN }).ok).toBe(false);
    });

    it("refuses an over-long string rather than truncating it", () => {
        expect(validateSettingsInput("demo", { note: "0123456789" }).ok).toBe(false);
    });

    it("refuses a body that is not an object", () => {
        expect(validateSettingsInput("demo", "flag=true").ok).toBe(false);
        expect(validateSettingsInput("demo", [1]).ok).toBe(false);
    });
});

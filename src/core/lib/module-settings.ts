import { ModuleSettings } from "@/core/generated/module-data";
import type { ModuleSetting } from "@/core/lib/module-types";

/**
 * Reading, validating and clamping a module's admin-editable settings.
 *
 * The manifest declaration (see `settings` in module-manifest-schema.ts) is the
 * only source: core never hardcodes a key, a default or a bound. Everything
 * here works from `ModuleSettings`, the generated map of declarations, so a
 * module that adds a setting gets a form field, input validation and a typed
 * read path without core changing.
 *
 * Stored values are treated as untrusted even though only an admin can write
 * them: a row can outlive the declaration that produced it (a module downgrade,
 * a setting removed in an update, a hand-edited database), and a module reading
 * its own settings must never have to defend against that.
 */

export type SettingValue = boolean | number | string;

/** The declarations a module ships, or an empty list for an unknown module. */
export function settingDeclarations(moduleId: string): ModuleSetting[] {
    return ModuleSettings[moduleId] ?? [];
}

/** Every declared key at its declared default. */
export function settingDefaults(moduleId: string): Record<string, SettingValue> {
    const out: Record<string, SettingValue> = {};
    for (const setting of settingDeclarations(moduleId)) out[setting.key] = setting.default;
    return out;
}

/**
 * One value forced into the shape its declaration promises, or `undefined`
 * when it cannot be: wrong type, not finite, or nothing supplied. Numbers are
 * clamped rather than rejected so a bound tightened in a module update narrows
 * a stored value instead of silently reverting it to the default.
 */
export function coerceSetting(setting: ModuleSetting, value: unknown): SettingValue | undefined {
    if (setting.type === "boolean") {
        return typeof value === "boolean" ? value : undefined;
    }
    if (setting.type === "number") {
        if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
        const min = setting.min ?? Number.NEGATIVE_INFINITY;
        const max = setting.max ?? Number.POSITIVE_INFINITY;
        return Math.min(Math.max(value, min), max);
    }
    if (typeof value !== "string") return undefined;
    return setting.maxLength === undefined ? value : value.slice(0, setting.maxLength);
}

/**
 * Declared defaults overlaid with whatever of the stored config survives its
 * declaration. Keys the manifest no longer declares are dropped, so a module
 * only ever sees the settings it asked for.
 */
export function resolveSettings(
    moduleId: string,
    stored: unknown,
): Record<string, SettingValue> {
    const resolved = settingDefaults(moduleId);
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return resolved;
    const bag = stored as Record<string, unknown>;
    for (const setting of settingDeclarations(moduleId)) {
        if (!(setting.key in bag)) continue;
        const value = coerceSetting(setting, bag[setting.key]);
        if (value !== undefined) resolved[setting.key] = value;
    }
    return resolved;
}

export type SettingsInputResult =
    | { ok: true; value: Record<string, SettingValue> }
    | { ok: false; error: string };

/**
 * What an admin submitted, checked against the declarations before it reaches
 * the database. Unlike `resolveSettings` this reports rather than repairs: a
 * form that sends an unknown key or the wrong type is a bug worth surfacing,
 * and the alternative - accepting an arbitrary JSON blob, which is what the
 * modules endpoint used to do - stores data no module will ever read.
 */
export function validateSettingsInput(moduleId: string, input: unknown): SettingsInputResult {
    if (input === undefined || input === null) return { ok: true, value: {} };
    if (typeof input !== "object" || Array.isArray(input)) {
        return { ok: false, error: "config must be an object" };
    }
    const declarations = settingDeclarations(moduleId);
    const byKey = new Map(declarations.map((s) => [s.key, s]));
    const bag = input as Record<string, unknown>;

    for (const key of Object.keys(bag)) {
        if (!byKey.has(key)) {
            return { ok: false, error: `Unknown setting "${key}" for module "${moduleId}"` };
        }
    }

    const value: Record<string, SettingValue> = {};
    for (const setting of declarations) {
        if (!(setting.key in bag)) continue;
        const raw = bag[setting.key];
        if (typeof raw !== setting.type) {
            return { ok: false, error: `Setting "${setting.key}" must be a ${setting.type}` };
        }
        if (setting.type === "number") {
            const n = raw as number;
            if (!Number.isFinite(n)) {
                return { ok: false, error: `Setting "${setting.key}" must be a finite number` };
            }
            if ((setting.min !== undefined && n < setting.min) || (setting.max !== undefined && n > setting.max)) {
                return { ok: false, error: `Setting "${setting.key}" must be between ${setting.min} and ${setting.max}` };
            }
        }
        if (setting.type === "string" && setting.maxLength !== undefined && (raw as string).length > setting.maxLength) {
            return { ok: false, error: `Setting "${setting.key}" must be at most ${setting.maxLength} characters` };
        }
        value[setting.key] = raw as SettingValue;
    }
    return { ok: true, value };
}

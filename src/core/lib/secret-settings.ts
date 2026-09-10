/**
 * The one place a stored credential is sealed, opened or withheld.
 *
 * An operator configures a payment gateway or an integration by pasting a key
 * into a settings form, and the value ends up in the shared `Setting` table.
 * It used to be written exactly as typed, which put every gateway's signing
 * secret in a JSON column: readable from a database backup, from a restored
 * dump, from any read-only session, and from any injection anywhere in the
 * app. `secret-storage.ts` had the cipher and one caller.
 *
 * What was missing was a boundary. Sealing on write only works if every write
 * goes through the same place, and opening on read only works if no module
 * reads the row itself, so both live here and the module read path is one SDK
 * call rather than fifteen copies of the same loop.
 *
 * Which keys are credentials is not core's to know. Naming any one of them in
 * a core file is core naming a module, so the modules declare their own in
 * `secretSettings` and this reads the aggregate. A `key.field` entry addresses
 * one field of a stored object, which is how a module with its own settings
 * endpoint keeps a whole configuration under a single key.
 *
 * Three rules hold the shape together:
 *
 * - An empty credential stays empty rather than becoming ciphertext. Clearing
 *   a key is how an operator removes a gateway, and an encrypted empty string
 *   reads back as configured.
 * - A value that will not decrypt reads as `null`, never as a throw. Rotating
 *   SECRET_ENCRYPTION_KEY must make a gateway say it is not configured, not
 *   take the checkout page down.
 * - A row written before any of this existed is returned as it stands. The
 *   alternative is that every already-configured install loses its payments
 *   on deploy, which is worse than the exposure being closed.
 */
import { ModuleSecretSettings } from "@/core/generated/module-data";
import { decryptSecret, encryptSecret, isEncrypted } from "@/core/lib/secret-storage";

/** Declared paths: a settings key, or `key.field` inside a stored object. */
export type SecretPaths = ReadonlySet<string>;

let cached: SecretPaths | null = null;

/** Every credential the installed modules have declared. */
function secretSettingPaths(): SecretPaths {
    cached ??= new Set(ModuleSecretSettings);
    return cached;
}

/** True if this settings key holds, or contains, a declared credential. */
export function isSecretSetting(key: string): boolean {
    for (const path of secretSettingPaths()) {
        if (path === key || path.startsWith(`${key}.`)) return true;
    }
    return false;
}

/**
 * Encrypt one credential. Throws on anything that is not a string: the column
 * is JSON, so a number would seal into a value that reads back as a string and
 * silently change the type the owning module receives.
 */
export function sealValue(value: string): string {
    if (typeof value !== "string") {
        throw new TypeError("sealValue expects a string; a credential is one");
    }
    return encryptSecret(value);
}

/** Decrypt one credential, passing through legacy plaintext and non-strings. */
export function openValue(stored: unknown): unknown {
    if (typeof stored !== "string") return stored;
    return decryptSecret(stored);
}

/** Nothing to seal: an empty credential is a cleared one, and a sealed one is done. */
function alreadySettled(value: unknown): boolean {
    return typeof value !== "string" || value === "" || isEncrypted(value);
}

/** The paths that address a field of `key`, as field names. */
function fieldsOf(key: string, paths: SecretPaths): string[] {
    const fields: string[] = [];
    for (const path of paths) {
        if (path.startsWith(`${key}.`)) fields.push(path.slice(key.length + 1));
    }
    return fields;
}

function mapOver(
    value: unknown,
    fields: string[],
    change: (field: unknown) => unknown,
): unknown {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const out = { ...(value as Record<string, unknown>) };
    for (const field of fields) {
        if (field in out) out[field] = change(out[field]);
    }
    return out;
}

/** A settings map with every declared credential sealed, ready for the column. */
export function settingsForStorage(
    map: Record<string, unknown>,
    paths: SecretPaths = secretSettingPaths(),
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(map)) {
        if (paths.has(key)) {
            out[key] = alreadySettled(value) ? value : sealValue(value as string);
            continue;
        }
        const fields = fieldsOf(key, paths);
        out[key] = fields.length === 0
            ? value
            : mapOver(value, fields, (v) => (alreadySettled(v) ? v : sealValue(v as string)));
    }
    return out;
}

/** One stored credential opened, or `null` when the key no longer fits it. */
function opened(value: unknown): unknown {
    try {
        return openValue(value);
    } catch {
        return null;
    }
}

/** A settings map as the owning module should see it. */
export function settingsFromStorage(
    map: Record<string, unknown>,
    paths: SecretPaths = secretSettingPaths(),
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(map)) {
        if (paths.has(key)) {
            out[key] = opened(value);
            continue;
        }
        const fields = fieldsOf(key, paths);
        out[key] = fields.length === 0 ? value : mapOver(value, fields, opened);
    }
    return out;
}

export interface PublicSettings {
    /** Everything an admin screen may see. No credential is in here. */
    settings: Record<string, unknown>;
    /** Declared paths that currently hold something, so a screen can say so. */
    secretsConfigured: string[];
}

/**
 * A settings map with every credential taken out.
 *
 * A password input hides a value from somebody standing behind the admin, not
 * from an extension reading the DOM or from whatever logs the JSON response.
 * The screen does not need the value to let an operator replace it - it needs
 * to know whether one is stored, which is what `secretsConfigured` says.
 */
export function withoutSecrets(
    map: Record<string, unknown>,
    paths: SecretPaths = secretSettingPaths(),
): PublicSettings {
    const settings: Record<string, unknown> = { ...map };
    const secretsConfigured: string[] = [];

    for (const path of paths) {
        const [key, field] = path.split(".");
        if (!(key in settings)) continue;

        if (field === undefined) {
            if (typeof settings[key] === "string" && settings[key] !== "") secretsConfigured.push(path);
            delete settings[key];
            continue;
        }

        const value = settings[key];
        if (!value || typeof value !== "object" || Array.isArray(value)) continue;
        const bag = { ...(value as Record<string, unknown>) };
        if (typeof bag[field] === "string" && bag[field] !== "") secretsConfigured.push(path);
        delete bag[field];
        settings[key] = bag;
    }

    return { settings, secretsConfigured };
}

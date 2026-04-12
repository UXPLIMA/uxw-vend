/**
 * Database-backed translation service.
 *
 * Translations live in the `Translation` table. Core translations are seeded
 * from `messages-core/*.json`. Module translations are written on install and
 * deleted on uninstall. Admin overrides (`isCustom = true`) always win.
 *
 * The merged message object is cached (Redis or in-memory) and invalidated
 * on module install/uninstall/enable/disable or admin edit.
 *
 * This replaces the build-time `clean-translations.ts` merge.
 */

import { prisma } from "@/core/lib/db";
import { cacheGet, cacheSet, cacheDel } from "@/core/lib/redis";

const CACHE_PREFIX = "uxw:translations:";
const CACHE_TTL_SECONDS = 120;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the full nested message object for a locale.
 * Called by next-intl's `getRequestConfig` on every request.
 */
export async function getMessages(locale: string): Promise<Record<string, unknown>> {
    const cacheKey = CACHE_PREFIX + locale;

    // 1. Try cache
    const cached = await cacheGet(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch { /* fall through */ }
    }

    // 2. Query DB — only core + enabled modules
    const enabledModuleIds = await getEnabledModuleIds();
    const allowedModules = ["core", ...enabledModuleIds];

    const rows = await prisma.translation.findMany({
        where: {
            locale,
            module: { in: allowedModules },
        },
        select: {
            namespace: true,
            key: true,
            value: true,
            module: true,
            isCustom: true,
        },
        orderBy: [
            { isCustom: "asc" },   // false first, true last (overwrites)
            { module: "asc" },     // core first, then modules
        ],
    });

    // 3. Build nested object with override priority:
    //    core < module < custom override
    const messages: Record<string, Record<string, unknown>> = {};

    for (const row of rows) {
        if (!messages[row.namespace]) messages[row.namespace] = {};
        setNestedValue(messages[row.namespace], row.key, row.value);
    }

    // 4. Cache and return
    const json = JSON.stringify(messages);
    await cacheSet(cacheKey, json, CACHE_TTL_SECONDS);

    return messages;
}

/**
 * Write a module's translations to the DB. Called during module install.
 * Translations come from `module.json` `translations` field:
 * ```json
 * { "en": { "admin": { "menu_blog": "Blog" }, "blog": { "title": "Blog" } } }
 * ```
 */
export async function syncModuleTranslations(
    moduleId: string,
    translations: Record<string, Record<string, unknown>>,
): Promise<void> {
    const rows = flattenTranslations(moduleId, translations);
    if (rows.length === 0) return;

    // Upsert in chunks to avoid huge queries
    const CHUNK_SIZE = 200;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        await Promise.all(
            chunk.map((r) =>
                prisma.translation.upsert({
                    where: {
                        locale_namespace_key_module: {
                            locale: r.locale,
                            namespace: r.namespace,
                            key: r.key,
                            module: r.module,
                        },
                    },
                    update: { value: r.value },
                    create: r,
                }),
            ),
        );
    }

    await invalidateTranslationCache();
}

/**
 * Remove all translations for a module. Called during module uninstall.
 * Admin overrides (isCustom = true) are preserved.
 */
export async function removeModuleTranslations(moduleId: string): Promise<void> {
    await prisma.translation.deleteMany({
        where: { module: moduleId, isCustom: false },
    });
    await invalidateTranslationCache();
}

/**
 * Invalidate the translation cache for all locales.
 * Call after install, uninstall, enable, disable, or admin edit.
 */
export async function invalidateTranslationCache(): Promise<void> {
    // Delete known locale caches
    const { locales } = await import("./config");
    await Promise.all(
        locales.map((l: string) => cacheDel(CACHE_PREFIX + l)),
    );
}

/**
 * Seed core translations from a nested JSON object.
 * Used by the seed script to populate from messages-core/*.json.
 */
export async function seedCoreTranslations(
    locale: string,
    data: Record<string, unknown>,
): Promise<number> {
    const rows = flattenSingleLocale("core", locale, data);
    let count = 0;

    const CHUNK_SIZE = 200;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        await Promise.all(
            chunk.map((r) =>
                prisma.translation.upsert({
                    where: {
                        locale_namespace_key_module: {
                            locale: r.locale,
                            namespace: r.namespace,
                            key: r.key,
                            module: r.module,
                        },
                    },
                    update: { value: r.value },
                    create: r,
                }),
            ),
        );
        count += chunk.length;
    }

    return count;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

async function getEnabledModuleIds(): Promise<string[]> {
    const modules = await prisma.moduleConfig.findMany({
        where: { enabled: true },
        select: { id: true },
    });
    return modules.map((m) => m.id);
}

/**
 * Flatten module translations into DB row format.
 * Input: { "en": { "admin": { "key": "val" }, "blog": { "title": "Blog" } } }
 * Output: [{ locale: "en", namespace: "admin", key: "key", value: "val", module }]
 */
function flattenTranslations(
    moduleId: string,
    translations: Record<string, Record<string, unknown>>,
): { locale: string; namespace: string; key: string; value: string; module: string }[] {
    const rows: { locale: string; namespace: string; key: string; value: string; module: string }[] = [];

    for (const [locale, namespaces] of Object.entries(translations)) {
        if (typeof namespaces !== "object" || namespaces === null) continue;
        for (const [namespace, content] of Object.entries(namespaces)) {
            if (typeof content === "string") {
                rows.push({ locale, namespace, key: "_root", value: content, module: moduleId });
            } else if (typeof content === "object" && content !== null) {
                flattenObject(content as Record<string, unknown>, "", (key, value) => {
                    rows.push({ locale, namespace, key, value: String(value), module: moduleId });
                });
            }
        }
    }

    return rows;
}

function flattenSingleLocale(
    moduleId: string,
    locale: string,
    data: Record<string, unknown>,
): { locale: string; namespace: string; key: string; value: string; module: string }[] {
    const rows: { locale: string; namespace: string; key: string; value: string; module: string }[] = [];

    for (const [namespace, content] of Object.entries(data)) {
        if (typeof content === "string") {
            rows.push({ locale, namespace, key: "_root", value: content, module: moduleId });
        } else if (typeof content === "object" && content !== null) {
            flattenObject(content as Record<string, unknown>, "", (key, value) => {
                rows.push({ locale, namespace, key, value: String(value), module: moduleId });
            });
        }
    }

    return rows;
}

function flattenObject(
    obj: Record<string, unknown>,
    prefix: string,
    emit: (key: string, value: string) => void,
): void {
    for (const [k, v] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${k}` : k;
        if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            flattenObject(v as Record<string, unknown>, fullKey, emit);
        } else {
            emit(fullKey, String(v ?? ""));
        }
    }
}

function setNestedValue(obj: Record<string, unknown>, dotPath: string, value: string): void {
    const parts = dotPath.split(".");
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (typeof current[part] !== "object" || current[part] === null) {
            current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
}

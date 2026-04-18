/**
 * Hook/Filter/Action API — the foundational extension mechanism.
 *
 * Inspired by WordPress but type-safe and ESM-first.
 *
 * Two primitives:
 *
 *   Actions — "fire and forget" notifications.
 *     doAction("user.registered", { userId }) — nothing is returned.
 *     Listeners run in priority order; if one throws, the others still run.
 *
 *   Filters — value transformation chains.
 *     const final = applyFilters("post.content", rawHtml, { post });
 *     Each listener receives the current value and returns the new value.
 *
 * Both are synchronous by default (performance) with async variants
 * (doActionAsync, applyFiltersAsync) for I/O-bound listeners.
 *
 * Modules register listeners either:
 *   1. Declaratively via module.json "hooks" field (build-time wired into
 *      the registry generator so they're bundled as static imports).
 *   2. Imperatively via addAction/addFilter at runtime.
 *
 * All listeners are removed when a module is disabled or uninstalled —
 * the module-cache invalidation calls removeModuleHooks(moduleId).
 */

export type ActionListener<T = unknown> = (payload: T) => void;
export type AsyncActionListener<T = unknown> = (payload: T) => void | Promise<void>;
export type FilterListener<T = unknown, C = unknown> = (value: T, context?: C) => T;
export type AsyncFilterListener<T = unknown, C = unknown> = (value: T, context?: C) => T | Promise<T>;

interface Registration {
    listener: (...args: unknown[]) => unknown;
    priority: number;
    moduleId?: string;
}

const actionRegistry = new Map<string, Registration[]>();
const filterRegistry = new Map<string, Registration[]>();

/** Lower priority = runs earlier. Default 10 (WordPress convention). */
const DEFAULT_PRIORITY = 10;

/**
 * Per-listener timeout for async hook dispatch. A misbehaving module hook
 * listener should NEVER be able to stall a user-facing request forever —
 * login, registration, and checkout all await async hook chains. Listeners
 * that don't resolve in this many milliseconds are abandoned (the dispatch
 * moves on) and logged as errors. Override via HOOK_LISTENER_TIMEOUT_MS env
 * (resolved lazily so tests can tweak the threshold per-run).
 */
const DEFAULT_HOOK_TIMEOUT_MS = 5000;

function getHookListenerTimeoutMs(): number {
    const raw = Number(process.env.HOOK_LISTENER_TIMEOUT_MS);
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HOOK_TIMEOUT_MS;
}

function raceWithTimeout<T>(promise: Promise<T> | T, label: string): Promise<T> {
    const timeoutMs = getHookListenerTimeoutMs();
    return new Promise<T>((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            reject(new Error(`hook listener timeout after ${timeoutMs}ms: ${label}`));
        }, timeoutMs);
        Promise.resolve(promise).then(
            (value) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                resolve(value);
            },
            (err) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

function addRegistration(map: Map<string, Registration[]>, name: string, reg: Registration) {
    const list = map.get(name) || [];
    list.push(reg);
    list.sort((a, b) => a.priority - b.priority);
    map.set(name, list);
}

function removeRegistration(map: Map<string, Registration[]>, name: string, listener: (...args: unknown[]) => unknown) {
    const list = map.get(name);
    if (!list) return;
    const filtered = list.filter((r) => r.listener !== listener);
    if (filtered.length === 0) {
        map.delete(name);
    } else {
        map.set(name, filtered);
    }
}

/* ───────────────────────────── Actions ──────────────────────────────── */

export function addAction<T>(
    name: string,
    listener: ActionListener<T> | AsyncActionListener<T>,
    options: { priority?: number; moduleId?: string } = {}
): void {
    addRegistration(actionRegistry, name, {
        listener: listener as (...args: unknown[]) => unknown,
        priority: options.priority ?? DEFAULT_PRIORITY,
        moduleId: options.moduleId,
    });
}

export function removeAction<T>(name: string, listener: ActionListener<T> | AsyncActionListener<T>): void {
    removeRegistration(actionRegistry, name, listener as (...args: unknown[]) => unknown);
}

/** Synchronous action dispatch. Errors in listeners are logged but do not propagate. */
export function doAction<T>(name: string, payload: T): void {
    const list = actionRegistry.get(name);
    if (!list || list.length === 0) return;
    for (const reg of list) {
        try {
            (reg.listener as ActionListener<T>)(payload);
        } catch (err) {
            console.error(`[hooks] Action "${name}" listener failed:`, err);
        }
    }
}

/** Async action dispatch. Awaits each listener in priority order. Errors are isolated. */
export async function doActionAsync<T>(name: string, payload: T): Promise<void> {
    const list = actionRegistry.get(name);
    if (!list || list.length === 0) return;
    for (const reg of list) {
        try {
            await raceWithTimeout(
                (reg.listener as AsyncActionListener<T>)(payload),
                `${name} (${reg.moduleId ?? "core"})`,
            );
        } catch (err) {
            console.error(`[hooks] Async action "${name}" listener failed:`, err);
        }
    }
}

/* ───────────────────────────── Filters ──────────────────────────────── */

export function addFilter<T, C = unknown>(
    name: string,
    listener: FilterListener<T, C> | AsyncFilterListener<T, C>,
    options: { priority?: number; moduleId?: string } = {}
): void {
    addRegistration(filterRegistry, name, {
        listener: listener as (...args: unknown[]) => unknown,
        priority: options.priority ?? DEFAULT_PRIORITY,
        moduleId: options.moduleId,
    });
}

export function removeFilter<T, C = unknown>(name: string, listener: FilterListener<T, C> | AsyncFilterListener<T, C>): void {
    removeRegistration(filterRegistry, name, listener as (...args: unknown[]) => unknown);
}

/** Apply a filter chain synchronously. Returns the transformed value. */
export function applyFilters<T, C = unknown>(name: string, value: T, context?: C): T {
    const list = filterRegistry.get(name);
    if (!list || list.length === 0) return value;
    let result = value;
    for (const reg of list) {
        try {
            result = (reg.listener as FilterListener<T, C>)(result, context);
        } catch (err) {
            console.error(`[hooks] Filter "${name}" listener failed:`, err);
            // Keep the previous value on error (fail-safe).
        }
    }
    return result;
}

/** Async filter chain — each listener can return a Promise. */
export async function applyFiltersAsync<T, C = unknown>(name: string, value: T, context?: C): Promise<T> {
    const list = filterRegistry.get(name);
    if (!list || list.length === 0) return value;
    let result = value;
    for (const reg of list) {
        try {
            result = await raceWithTimeout(
                (reg.listener as AsyncFilterListener<T, C>)(result, context),
                `${name} (${reg.moduleId ?? "core"})`,
            );
        } catch (err) {
            console.error(`[hooks] Async filter "${name}" listener failed:`, err);
            // Keep the previous value so a slow/broken listener doesn't
            // corrupt the chain — downstream listeners still get a value.
        }
    }
    return result;
}

/* ───────────────────────── Module lifecycle ─────────────────────────── */

/** Remove all hooks registered by a module (called on disable/uninstall). */
export function removeModuleHooks(moduleId: string): void {
    for (const [name, list] of actionRegistry.entries()) {
        const filtered = list.filter((r) => r.moduleId !== moduleId);
        if (filtered.length === 0) actionRegistry.delete(name);
        else actionRegistry.set(name, filtered);
    }
    for (const [name, list] of filterRegistry.entries()) {
        const filtered = list.filter((r) => r.moduleId !== moduleId);
        if (filtered.length === 0) filterRegistry.delete(name);
        else filterRegistry.set(name, filtered);
    }
}

/* ───────────────────────── Introspection ────────────────────────────── */

/** List all registered action hooks (for dev tools / debugging). */
export function listActions(): { name: string; count: number; modules: string[] }[] {
    return Array.from(actionRegistry.entries()).map(([name, list]) => ({
        name,
        count: list.length,
        modules: Array.from(new Set(list.map((r) => r.moduleId || "core"))),
    }));
}

/** List all registered filter hooks. */
export function listFilters(): { name: string; count: number; modules: string[] }[] {
    return Array.from(filterRegistry.entries()).map(([name, list]) => ({
        name,
        count: list.length,
        modules: Array.from(new Set(list.map((r) => r.moduleId || "core"))),
    }));
}

/** Count listeners for a specific hook. Useful for conditional logic. */
export function hasAction(name: string): boolean {
    const list = actionRegistry.get(name);
    return !!list && list.length > 0;
}

export function hasFilter(name: string): boolean {
    const list = filterRegistry.get(name);
    return !!list && list.length > 0;
}

/* ───────────────────────── Bootstrap ───────────────────────────────── */

let bootstrapped = false;

/**
 * Load and register all module hook listeners.
 * Called once per server process. Idempotent.
 *
 * Reads from the auto-generated module-hooks.ts registry and lazy-imports
 * each listener module. Modules whose status is "disabled" in module-cache
 * are skipped. Disabled modules' listeners are removed when status changes
 * (via removeModuleHooks).
 */
export async function bootstrapHooks(): Promise<void> {
    if (bootstrapped) return;
    bootstrapped = true;

    // Core listeners — activity feed, trophies, etc.
    try {
        const { registerActivityFeedListeners } = await import("./activity-feed");
        registerActivityFeedListeners();
        const { registerTrophyListeners } = await import("./trophies");
        await registerTrophyListeners();
    } catch (err) {
        console.error("[hooks] Failed to register core listeners:", err);
    }

    try {
        const { ModuleHookListeners } = await import("@/core/generated/module-hooks");
        const { getModuleStates } = await import("@/core/lib/module-cache");
        const states = await getModuleStates();

        for (const entry of ModuleHookListeners) {
            // Skip disabled modules
            if (states[entry.module] === false) continue;

            try {
                const mod = await entry.loader();
                const listener = mod.default;
                if (typeof listener !== "function") {
                    console.warn(`[hooks] ${entry.module}/${entry.hook}: handler did not export a default function`);
                    continue;
                }
                if (entry.type === "action") {
                    addAction(entry.hook, listener as ActionListener, {
                        priority: entry.priority,
                        moduleId: entry.module,
                    });
                } else {
                    addFilter(entry.hook, listener as FilterListener, {
                        priority: entry.priority,
                        moduleId: entry.module,
                    });
                }
            } catch (err) {
                console.error(`[hooks] Failed to load ${entry.module}/${entry.hook}:`, err);
            }
        }

        console.log(`[hooks] Registered ${ModuleHookListeners.length} module hook listeners`);
    } catch (err) {
        // module-hooks.ts may not exist on first build — fail silently
        console.warn("[hooks] Could not load module-hooks registry:", (err as Error).message);
    }
}

/** Force re-bootstrap (used when modules are enabled/disabled at runtime). */
export function resetHooks(): void {
    actionRegistry.clear();
    filterRegistry.clear();
    bootstrapped = false;
}

/* ───────────────────────── Standard hook names ──────────────────────── */

/**
 * Conventional hook names. Not enforced — modules can use any string.
 * Documented here so consumers have a shared vocabulary.
 *
 * Naming convention: `<noun>.<verb>` for actions, `<noun>.<adjective>` for filters.
 * Tense: present for "happening now", past for "already done".
 */
export const HookNames = {
    // Lifecycle
    MODULE_ENABLED: "module.enabled",
    MODULE_DISABLED: "module.disabled",
    MODULE_INSTALLED: "module.installed",
    MODULE_UNINSTALLED: "module.uninstalled",

    // User
    USER_REGISTERED: "user.registered",
    USER_LOGGED_IN: "user.loggedIn",
    USER_LOGGED_OUT: "user.loggedOut",
    USER_UPDATED: "user.updated",
    USER_DELETED: "user.deleted",
    USER_BANNED: "user.banned",

    // Generic CRUD (modules emit <resource>.created/updated/deleted)
    // e.g. "store.product.created", "blog.article.updated"

    // Filters — transform output
    PAGE_TITLE: "page.title",
    PAGE_META: "page.meta",
    NAVBAR_LINKS: "navbar.links",
    FOOTER_LINKS: "footer.links",
    ADMIN_SIDEBAR: "admin.sidebar",
    EMAIL_SUBJECT: "email.subject",
    EMAIL_BODY: "email.body",
} as const;

/**
 * uxwVend module SDK - isomorphic surface.
 *
 * This is the supported import path for modules. `@/core/lib/*` is core's
 * internal layout and modules must not reach into it: core refactors freely
 * behind this file, and `scripts/validate-module.ts` rejects a module that
 * bypasses it.
 *
 * Every symbol is listed explicitly rather than re-exported with `export *`,
 * so widening the public surface is a visible diff someone has to approve.
 *
 * Entry points are split by runtime, not by topic - a barrel that mixed them
 * would drag `prisma` into a client bundle the moment a component imported
 * `formatDate`.
 *
 * This file in particular stays dependency-light on purpose: `clsx`,
 * `tailwind-merge` and a hook bus with no imports at all. The project declares
 * no `sideEffects: false`, so a bundler cannot drop unused re-exports from a
 * barrel - anything heavy added here is paid for by every client component
 * that imports `formatDate`. `sanitizeHtml` lives in `/server` for exactly
 * that reason: it pulls `isomorphic-dompurify`, and no module uses it from
 * client code.
 *
 *   `@/core/sdk`             this file - safe in server AND client code
 *   `@/core/sdk/server`      server-only: database, permissions, crypto, I/O
 *   `@/core/sdk/auth`        the Auth.js session helper
 *   `@/core/sdk/navigation`  locale-aware client navigation
 *   `@/core/sdk/blocks`      page-builder block config (pulls in Puck)
 *   `@/core/sdk/theme`       active theme config + component overrides
 *   `@/core/sdk/ui`          shared UI primitives (client)
 *   `@/core/sdk/layout`      navbar / footer / slots (page composition)
 *   `@/core/sdk/admin`       admin CRUD and settings scaffolds
 *
 * Adding a symbol here is a minor CORE_API_VERSION bump; changing or removing
 * one is a major bump. See `core-version.ts`.
 */

// --- Formatting and string helpers (clsx / tailwind-merge only) ---
export {
    cn,
    formatCurrency,
    formatDate,
    slugify,
    generateSlug,
    generateOrderNumber,
} from "@/core/lib/utils";

// --- The hook bus: how modules talk to core and to each other ---
export {
    addAction,
    addFilter,
    doAction,
    doActionAsync,
    applyFilters,
    applyFiltersAsync,
    HookNames,
} from "@/core/lib/hooks";

/**
 * Hook typing helpers. `HookHandlerFor` is the one module authors reach for -
 * it types a `hookListeners` handler from the hook's declared payload:
 *
 *     const onOrderCreated: HookHandlerFor<"store.order.created", "action"> =
 *         async (order) => { … };
 *     export default onOrderCreated;
 *
 * The payload itself is declared by whichever module FIRES the hook, in a
 * `declare global { interface UxwVendHookPayloads { … } }` block. See
 * docs/PLUGIN_SDK.md.
 */
export type {
    ActionPayload,
    FilterValue,
    FilterContext,
    HookHandlerFor,
    AssertHookHandler,
    Expect,
} from "@/core/lib/hooks";

/**
 * uxwVend module SDK - server-only surface.
 *
 * Every symbol here reaches the database, the filesystem, or Node crypto, so
 * importing it from a `"use client"` file fails the build. Client code wants
 * `@/core/sdk`.
 *
 * (No `server-only` guard import: that package is not a dependency of this
 * project and nothing else in the tree uses it. The bundler already rejects
 * these imports from a client component, which is the same outcome.)
 *
 * See `@/core/sdk` for the entry-point map and the rules for changing this
 * surface.
 */
// --- HTML sanitisation (isomorphic-dompurify; kept out of the light barrel) ---
export { sanitizeHtml } from "@/core/lib/sanitize";

// --- Database ---
export { prisma } from "@/core/lib/db";

// --- Homepage sections a theme or a module can render directly ---
// Reads the activity feed straight from the database rather than through the
// API. Its own doc comment always described it as something a theme could
// render; until it was exported here, the SDK boundary made that impossible.
export { ActivityFeedSection } from "@/core/components/homepage/ActivityFeedSection";

// --- Module state: what a module calls to gate its own endpoints ---
export { isModuleEnabled } from "@/core/lib/module-cache";

// --- Authorization (session lookup lives in @/core/sdk/auth) ---
export { hasPermission, hasResourcePermission, isAdmin } from "@/core/lib/permissions";

// --- Rate limiting ---
export {
    getClientIP,
    rateLimits,
    rateLimitForRole,
    rateLimitForRoleAsync,
} from "@/core/lib/rate-limit";

/**
 * A limit an operator's role multipliers cannot lift.
 *
 * `rateLimitForRole` scales its budget by the caller's role, and a multiplier
 * of 0 means unlimited - the right shape for throughput, the wrong one for a
 * guard on guessing a secret. Use this for the endpoints where the request
 * body is a password, a one-time code or a gift code: the ceiling is what
 * makes the guess unaffordable, so it has to hold for every role.
 */
export { rateLimit as rateLimitStrict } from "@/core/lib/rate-limit";

// --- Caching (Redis with in-memory fallback) ---
export { cached, invalidate } from "@/core/lib/cache";

// --- At-rest secret encryption for module config ---
export { encryptSecret, decryptSecret } from "@/core/lib/secret-storage";

// --- Audit trail ---
export { logActivity } from "@/core/lib/activity-log";

// --- Content revisions ---
export { recordRevision } from "@/core/lib/revisions";

// --- Uploads ---
export { sanitizeFilename } from "@/core/lib/storage";
export type { StorageProvider, UploadResult } from "@/core/lib/storage";

// --- TOTP / backup codes ---
export {
    generateSecret,
    generateQRCode,
    verifyToken,
    generateBackupCodes,
    countRemainingBackupCodes,
} from "@/core/lib/two-factor";

// --- API response envelope ---
export { apiSuccess, apiError, apiPaginated, devOnlyDetail, withRateLimit } from "@/core/lib/api-utils";

// --- Charts ---
// A per-day count the database computes. Five stats screens read every row in
// the window and bucketed it in JavaScript, so the work grew with the site's
// history to produce at most 366 numbers.
export { dailySeries, dayLabels } from "@/core/lib/daily-series";
export type { DailySeriesOptions, DailySeriesRow } from "@/core/lib/daily-series";

// --- Request bodies ---
// `readJsonBody` returns the parsed body, or the 400 to return when the body
// is not JSON. A route that calls `request.json()` directly answers a
// malformed body with a 500.
export { readJsonBody, INVALID_JSON_BODY, BODY_TOO_LARGE, MAX_JSON_BODY_BYTES } from "@/core/lib/api-body";

// `intParam` and `enumParam` are the query-string half of the same idea: a
// page number that cannot be NaN, and an enum filter that answers 400 instead
// of handing Prisma a value its enum does not have.
export { intParam, enumParam, INVALID_QUERY_PARAM } from "@/core/lib/api-query";

// --- Transactional email ---
export { sendEmail, queueEmail } from "@/core/lib/email";

// --- Structured data ---
export { buildArticleJsonLd } from "@/core/lib/seo";

// Structured logging. A module's cron jobs and hook listeners run outside any
// request, and `log` handles that - it reads the correlation id from
// AsyncLocalStorage when there is one and falls back cleanly when there is not.
// Server-only because logger.ts imports next/headers.
export { log } from "@/core/lib/logger";

// Canonical public URL of this installation, resolved at runtime. A module
// that has to hand an external service an absolute callback URL needs this
// rather than a NEXT_PUBLIC_* var, which `next build` freezes into the
// prebuilt image for every installation on earth.
export { resolveAppUrl, resolveAppName } from "@/core/lib/app-url";

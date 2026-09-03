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

// --- Transactional email ---
export { sendEmail, queueEmail } from "@/core/lib/email";

// --- Structured data ---
export { buildArticleJsonLd } from "@/core/lib/seo";

// Structured logging. A module's cron jobs and hook listeners run outside any
// request, and `log` handles that - it reads the correlation id from
// AsyncLocalStorage when there is one and falls back cleanly when there is not.
// Server-only because logger.ts imports next/headers.
export { log } from "@/core/lib/logger";

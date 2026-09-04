// Auth
export const BCRYPT_ROUNDS = 12;
export const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1h
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const BACKUP_CODES_COUNT = 8;

// Rate limits (defaults, can be overridden by settings)
export const RATE_LIMIT_AUTH = { maxRequests: 10, windowMs: 60000 };
export const RATE_LIMIT_API = { maxRequests: 120, windowMs: 60000 };
export const RATE_LIMIT_UPLOAD = { maxRequests: 3, windowMs: 60000 };

// Pagination defaults (core admin)
export const PER_PAGE_USERS = 20;
export const PER_PAGE_ACTIVITY = 50;

// Public search
// The longest query /api/v1/search will act on. Every enabled module's search
// provider is handed this string, and each one puts it through a full-text
// parse or an ILIKE scan, so an unbounded value turns one anonymous request
// into a fan-out of expensive queries. No person types a search term this
// long; the input on the search page carries the same cap.
export const SEARCH_QUERY_MAX_LENGTH = 128;

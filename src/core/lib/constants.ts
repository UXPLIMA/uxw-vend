// Auth
export const BCRYPT_ROUNDS = 12;
export const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1h
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const BACKUP_CODES_COUNT = 8;

/**
 * The role priority at which a role counts as staff.
 *
 * Roles are the admin's to create, rename and reorder, so "staff" is a
 * position on that ladder rather than a list of names. Three places measured
 * it independently and one of them measured something else entirely: the
 * server-side check accepted the role *name* "moderator" straight off the
 * session, so demoting that role in the admin panel hid the staff links and
 * left the endpoints behind them open.
 */
export const STAFF_ROLE_PRIORITY = 50;

// Rate limits (defaults, can be overridden by settings)
export const RATE_LIMIT_AUTH = { maxRequests: 10, windowMs: 60000 };
export const RATE_LIMIT_API = { maxRequests: 120, windowMs: 60000 };
export const RATE_LIMIT_UPLOAD = { maxRequests: 3, windowMs: 60000 };

/**
 * The ceiling on an endpoint a payment provider posts to.
 *
 * Deliberately far above what a real provider sends: a webhook throttled
 * during a burst delays a settlement, which is a worse failure than the one
 * the limit exists to prevent. It is still a ceiling, and without one a
 * stranger could make this server call the provider's API once per request -
 * a callback handler reads the payment back before it trusts anything - until
 * the operator's quota with that provider was gone.
 */
export const RATE_LIMIT_PROVIDER_CALLBACK = { maxRequests: 600, windowMs: 60000 };

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

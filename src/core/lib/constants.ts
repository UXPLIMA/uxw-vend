// Auth
export const BCRYPT_ROUNDS = 12;
export const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1h
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 100;
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

// Auth
export const BCRYPT_ROUNDS = 12;
export const EMAIL_VERIFY_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
export const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1h
export const PASSWORD_MIN_LENGTH = 6;
export const PASSWORD_MAX_LENGTH = 100;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

// Rate limits (defaults, can be overridden by settings)
export const RATE_LIMIT_AUTH = { maxRequests: 10, windowMs: 60000 };
export const RATE_LIMIT_API = { maxRequests: 120, windowMs: 60000 };
export const RATE_LIMIT_CHECKOUT = { maxRequests: 5, windowMs: 60000 };
export const RATE_LIMIT_UPLOAD = { maxRequests: 3, windowMs: 60000 };
export const RATE_LIMIT_VOTE = { maxRequests: 10, windowMs: 60000 };
export const RATE_LIMIT_SPIN = { maxRequests: 2, windowMs: 60000 };

// Business logic defaults
export const WHEEL_SPIN_COOLDOWN_HOURS = 24;
export const VOTE_COOLDOWN_HOURS = 24;
export const ORDER_AUTO_CANCEL_HOURS = 24;
export const TICKET_AUTO_CLOSE_DAYS = 7;
export const CREATOR_DEFAULT_DISCOUNT = 5;
export const CREATOR_DEFAULT_COMMISSION = 5;
export const BACKUP_CODES_COUNT = 8;

// Pagination defaults
export const PER_PAGE_PRODUCTS = 12;
export const PER_PAGE_BLOG = 10;
export const PER_PAGE_FORUM = 20;
export const PER_PAGE_TICKETS = 10;
export const PER_PAGE_USERS = 20;
export const PER_PAGE_LEADERBOARD = 20;
export const PER_PAGE_SUGGESTIONS = 20;
export const PER_PAGE_PUNISHMENTS = 20;
export const PER_PAGE_ACTIVITY = 50;
export const PER_PAGE_HOME_NEWS = 4;

// Cache TTLs
export const SETTINGS_CACHE_MS = 60000;
export const SERVER_QUERY_CACHE_MS = 60000;
export const SLIDER_INTERVAL_MS = 5000;

// Widget
export const WIDGET_RECENT_PURCHASES_COUNT = 4;

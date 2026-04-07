import { describe, it, expect } from 'vitest';
import {
    BCRYPT_ROUNDS,
    EMAIL_VERIFY_EXPIRY_MS,
    PASSWORD_RESET_EXPIRY_MS,
    PASSWORD_MIN_LENGTH,
    PASSWORD_MAX_LENGTH,
    USERNAME_MIN_LENGTH,
    USERNAME_MAX_LENGTH,
    BACKUP_CODES_COUNT,
    RATE_LIMIT_AUTH,
    RATE_LIMIT_API,
    RATE_LIMIT_UPLOAD,
    PER_PAGE_USERS,
    PER_PAGE_ACTIVITY,
} from '@/core/lib/constants';

describe('Auth constants', () => {
    it('bcrypt rounds is at least 10', () => {
        expect(BCRYPT_ROUNDS).toBeGreaterThanOrEqual(10);
    });

    it('email verify expiry is 24 hours', () => {
        expect(EMAIL_VERIFY_EXPIRY_MS).toBe(24 * 60 * 60 * 1000);
    });

    it('password reset expiry is 1 hour', () => {
        expect(PASSWORD_RESET_EXPIRY_MS).toBe(60 * 60 * 1000);
    });

    it('password length constraints are sensible', () => {
        expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(6);
        expect(PASSWORD_MAX_LENGTH).toBeLessThanOrEqual(200);
        expect(PASSWORD_MAX_LENGTH).toBeGreaterThan(PASSWORD_MIN_LENGTH);
    });

    it('username length constraints are sensible', () => {
        expect(USERNAME_MIN_LENGTH).toBeGreaterThanOrEqual(2);
        expect(USERNAME_MAX_LENGTH).toBeLessThanOrEqual(50);
    });

    it('backup codes count is at least 6', () => {
        expect(BACKUP_CODES_COUNT).toBeGreaterThanOrEqual(6);
    });
});

describe('Rate limit constants', () => {
    it('auth is stricter than API', () => {
        expect(RATE_LIMIT_AUTH.maxRequests).toBeLessThan(RATE_LIMIT_API.maxRequests);
    });

    it('upload is the strictest', () => {
        expect(RATE_LIMIT_UPLOAD.maxRequests).toBeLessThanOrEqual(RATE_LIMIT_AUTH.maxRequests);
    });

    it('all have positive window', () => {
        for (const config of [RATE_LIMIT_AUTH, RATE_LIMIT_API, RATE_LIMIT_UPLOAD]) {
            expect(config.windowMs).toBeGreaterThan(0);
        }
    });
});

describe('Pagination constants', () => {
    it('per page users is reasonable', () => {
        expect(PER_PAGE_USERS).toBeGreaterThanOrEqual(10);
        expect(PER_PAGE_USERS).toBeLessThanOrEqual(100);
    });

    it('per page activity is reasonable', () => {
        expect(PER_PAGE_ACTIVITY).toBeGreaterThanOrEqual(10);
        expect(PER_PAGE_ACTIVITY).toBeLessThanOrEqual(200);
    });
});

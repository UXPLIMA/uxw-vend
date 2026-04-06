import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock redis (not available in test)
vi.mock('redis', () => ({ createClient: vi.fn() }));

// Mock constants
vi.mock('@/core/lib/constants', () => ({
    RATE_LIMIT_AUTH: { maxRequests: 10, windowMs: 60000 },
    RATE_LIMIT_API: { maxRequests: 120, windowMs: 60000 },
    RATE_LIMIT_CHECKOUT: { maxRequests: 5, windowMs: 60000 },
    RATE_LIMIT_UPLOAD: { maxRequests: 3, windowMs: 60000 },
}));

// Need to dynamically import after mocks
let rateLimit: typeof import('@/core/lib/rate-limit').rateLimit;
let getClientIP: typeof import('@/core/lib/rate-limit').getClientIP;
let rateLimits: typeof import('@/core/lib/rate-limit').rateLimits;

beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/core/lib/rate-limit');
    rateLimit = mod.rateLimit;
    getClientIP = mod.getClientIP;
    rateLimits = mod.rateLimits;
});

describe('rateLimit', () => {
    it('allows requests within limit', async () => {
        const result = await rateLimit('test-user-1', { maxRequests: 5, windowMs: 60000 });
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(4);
    });

    it('blocks after exceeding limit', async () => {
        const config = { maxRequests: 3, windowMs: 60000 };
        const id = 'test-block-' + Date.now();

        await rateLimit(id, config);
        await rateLimit(id, config);
        await rateLimit(id, config);
        const fourth = await rateLimit(id, config);

        expect(fourth.success).toBe(false);
        expect(fourth.remaining).toBe(0);
    });

    it('tracks remaining count correctly', async () => {
        const config = { maxRequests: 5, windowMs: 60000 };
        const id = 'test-remaining-' + Date.now();

        const r1 = await rateLimit(id, config);
        const r2 = await rateLimit(id, config);

        expect(r1.remaining).toBe(4);
        expect(r2.remaining).toBe(3);
    });

    it('uses default config when not specified', async () => {
        const result = await rateLimit('test-default-' + Date.now());
        expect(result.success).toBe(true);
        expect(result.remaining).toBe(59); // default is 60
    });
});

describe('getClientIP', () => {
    it('extracts IP from x-forwarded-for', () => {
        const headers = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
        expect(getClientIP(headers)).toBe('1.2.3.4');
    });

    it('falls back to x-real-ip', () => {
        const headers = new Headers({ 'x-real-ip': '10.0.0.1' });
        expect(getClientIP(headers)).toBe('10.0.0.1');
    });

    it('returns unknown when no IP headers', () => {
        expect(getClientIP(new Headers())).toBe('unknown');
    });
});

describe('rateLimits presets', () => {
    it('has correct auth preset', () => {
        expect(rateLimits.auth).toEqual({ maxRequests: 10, windowMs: 60000 });
    });

    it('has correct api preset', () => {
        expect(rateLimits.api).toEqual({ maxRequests: 120, windowMs: 60000 });
    });

    it('has correct upload preset', () => {
        expect(rateLimits.upload).toEqual({ maxRequests: 3, windowMs: 60000 });
    });
});

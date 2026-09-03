import { describe, it, expect } from "vitest";
import {
    REMEMBERED_MAX_AGE_SECONDS,
    SESSION_MAX_AGE_SECONDS,
    parseRemember,
    sessionExpired,
    sessionExpiresAt,
} from "@/core/lib/session-lifetime";

const NOW = 1_700_000_000_000;

describe("parseRemember", () => {
    it("accepts the values a checkbox can arrive as", () => {
        for (const raw of ["true", "1", "on", "yes", "TRUE", " True ", true]) {
            expect(parseRemember(raw), String(raw)).toBe(true);
        }
    });

    it("treats anything else as not remembered", () => {
        for (const raw of ["false", "0", "off", "", "  ", undefined, null, 1, {}]) {
            expect(parseRemember(raw), String(raw)).toBe(false);
        }
    });
});

describe("sessionExpiresAt", () => {
    it("gives an un-remembered session the short lifetime", () => {
        expect(sessionExpiresAt(false, NOW)).toBe(NOW + SESSION_MAX_AGE_SECONDS * 1000);
    });

    it("gives a remembered session the long one", () => {
        expect(sessionExpiresAt(true, NOW)).toBe(NOW + REMEMBERED_MAX_AGE_SECONDS * 1000);
    });

    it("keeps the remembered lifetime longer than the default", () => {
        expect(REMEMBERED_MAX_AGE_SECONDS).toBeGreaterThan(SESSION_MAX_AGE_SECONDS);
    });
});

describe("sessionExpired", () => {
    it("is false before the deadline and true at or after it", () => {
        const expiry = sessionExpiresAt(false, NOW);
        expect(sessionExpired({ absoluteExpiry: expiry }, expiry - 1)).toBe(false);
        expect(sessionExpired({ absoluteExpiry: expiry }, expiry)).toBe(true);
        expect(sessionExpired({ absoluteExpiry: expiry }, expiry + 1)).toBe(true);
    });

    it("lets tokens issued before the field existed keep working", () => {
        expect(sessionExpired({}, NOW)).toBe(false);
        expect(sessionExpired(null, NOW)).toBe(false);
        expect(sessionExpired(undefined, NOW)).toBe(false);
    });

    it("ignores a deadline that is not a usable number", () => {
        expect(sessionExpired({ absoluteExpiry: "soon" }, NOW)).toBe(false);
        expect(sessionExpired({ absoluteExpiry: Number.NaN }, NOW)).toBe(false);
        expect(sessionExpired({ absoluteExpiry: Number.POSITIVE_INFINITY }, NOW)).toBe(false);
    });
});

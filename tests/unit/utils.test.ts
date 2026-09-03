import { describe, it, expect, vi, afterEach } from "vitest";
import {
    cn,
    formatCurrency,
    formatDate,
    formatRelativeTime,
    generateId,
    slugify,
    generateSlug,
    truncate,
    sleep,
    safeJsonParse,
    generateOrderNumber,
} from "@/core/lib/utils";

/**
 * utils.ts is re-exported through the module SDK, so its behaviour is a
 * published contract that third-party modules build on - changing
 * `slugify` silently changes every module URL derived from a title.
 * It sat at 9.5% coverage.
 */

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("cn", () => {
    it("joins class names", () => {
        expect(cn("a", "b")).toBe("a b");
    });

    it("drops falsy values", () => {
        expect(cn("a", false, undefined, null, "b")).toBe("a b");
    });

    it("lets the later Tailwind utility win a conflict", () => {
        expect(cn("p-2", "p-4")).toBe("p-4");
    });

    it("accepts arrays and conditional objects", () => {
        expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
    });

    it("returns an empty string for no input", () => {
        expect(cn()).toBe("");
    });
});

describe("formatCurrency", () => {
    it("defaults to USD in en-US", () => {
        expect(formatCurrency(1234.5)).toBe("$1,234.50");
    });

    it("honours an explicit currency", () => {
        expect(formatCurrency(10, "EUR", "en-US")).toBe("€10.00");
    });

    it("formats negative amounts", () => {
        expect(formatCurrency(-5)).toBe("-$5.00");
    });

    it("formats zero", () => {
        expect(formatCurrency(0)).toBe("$0.00");
    });

    it("uses the requested locale's grouping", () => {
        // de-DE uses a dot for thousands and a comma for decimals.
        const out = formatCurrency(1234.5, "EUR", "de-DE");
        expect(out).toContain("1.234");
        expect(out).toContain(",50");
    });
});

describe("formatDate", () => {
    const date = new Date("2026-03-09T12:00:00.000Z");

    it("renders a long-form date by default", () => {
        expect(formatDate(date, undefined, "en-US")).toBe("March 9, 2026");
    });

    it("accepts an ISO string", () => {
        expect(formatDate("2026-03-09T12:00:00.000Z", undefined, "en-US"))
            .toBe("March 9, 2026");
    });

    it("lets options override the defaults", () => {
        expect(formatDate(date, { month: "short", day: "numeric", year: "numeric" }, "en-US"))
            .toBe("Mar 9, 2026");
    });

    it("localizes to the requested locale", () => {
        expect(formatDate(date, undefined, "tr-TR")).toContain("Mart");
    });
});

describe("formatRelativeTime", () => {
    const now = new Date("2026-03-09T12:00:00.000Z");

    function at(offsetMs: number): Date {
        return new Date(now.getTime() - offsetMs);
    }

    it("reports seconds", () => {
        vi.setSystemTime(now);
        expect(formatRelativeTime(at(30_000))).toBe("30 seconds ago");
    });

    it("reports minutes", () => {
        vi.setSystemTime(now);
        expect(formatRelativeTime(at(5 * 60_000))).toBe("5 minutes ago");
    });

    it("reports hours", () => {
        vi.setSystemTime(now);
        expect(formatRelativeTime(at(3 * 3_600_000))).toBe("3 hours ago");
    });

    it("reports days", () => {
        vi.setSystemTime(now);
        expect(formatRelativeTime(at(2 * 86_400_000))).toBe("2 days ago");
    });

    it("uses 'yesterday' rather than '1 day ago'", () => {
        vi.setSystemTime(now);
        // numeric: "auto" is what makes this read naturally.
        expect(formatRelativeTime(at(86_400_000))).toBe("yesterday");
    });

    it("switches to an absolute date beyond a week", () => {
        vi.setSystemTime(now);
        expect(formatRelativeTime(at(8 * 86_400_000), "en-US")).toBe("March 1, 2026");
    });

    it("accepts an ISO string", () => {
        vi.setSystemTime(now);
        expect(formatRelativeTime(at(60_000).toISOString())).toBe("1 minute ago");
    });

    it("localizes the relative phrase", () => {
        vi.setSystemTime(now);
        expect(formatRelativeTime(at(5 * 60_000), "tr")).toContain("dakika");
    });
});

describe("generateId", () => {
    it("defaults to 12 characters", () => {
        expect(generateId()).toHaveLength(12);
    });

    it("honours an explicit length", () => {
        expect(generateId(32)).toHaveLength(32);
    });

    it("returns an empty string for length zero", () => {
        expect(generateId(0)).toBe("");
    });

    it("emits only alphanumerics", () => {
        expect(generateId(200)).toMatch(/^[A-Za-z0-9]+$/);
    });

    it("does not repeat itself across calls", () => {
        const seen = new Set(Array.from({ length: 50 }, () => generateId()));
        expect(seen.size).toBe(50);
    });
});

describe("slugify", () => {
    it("lowercases and hyphenates", () => {
        expect(slugify("Hello World")).toBe("hello-world");
    });

    it("transliterates Turkish characters that NFD cannot decompose", () => {
        expect(slugify("Çiğdem Şahin ırmak")).toBe("cigdem-sahin-irmak");
    });

    it("maps dotted capital I to a plain i", () => {
        expect(slugify("İstanbul")).toBe("istanbul");
    });

    it("strips European diacritics via NFD", () => {
        expect(slugify("Café Crème")).toBe("cafe-creme");
    });

    it("expands the multi-character transliterations", () => {
        expect(slugify("Straße")).toBe("strasse");
        expect(slugify("Œuvre")).toBe("oeuvre");
    });

    it("drops punctuation", () => {
        expect(slugify("What's new? (2026)")).toBe("whats-new-2026");
    });

    it("collapses runs of hyphens", () => {
        expect(slugify("a   ---   b")).toBe("a-b");
    });

    it("trims leading and trailing hyphens", () => {
        expect(slugify("  -- hello --  ")).toBe("hello");
    });

    it("keeps underscores and digits", () => {
        expect(slugify("v2_release")).toBe("v2_release");
    });

    it("returns an empty string when nothing survives", () => {
        expect(slugify("!!!")).toBe("");
        expect(slugify("")).toBe("");
    });

    it("is idempotent", () => {
        const once = slugify("Çiğdem's Café - 2026!");
        expect(slugify(once)).toBe(once);
    });

    it("is exposed under the generateSlug alias", () => {
        expect(generateSlug).toBe(slugify);
    });
});

describe("truncate", () => {
    it("leaves a short string alone", () => {
        expect(truncate("hello", 10)).toBe("hello");
    });

    it("leaves a string of exactly the limit alone", () => {
        expect(truncate("hello", 5)).toBe("hello");
    });

    it("cuts and appends an ellipsis", () => {
        expect(truncate("hello world", 5)).toBe("hello...");
    });

    it("handles a zero limit", () => {
        expect(truncate("hello", 0)).toBe("...");
    });

    it("handles an empty string", () => {
        expect(truncate("", 5)).toBe("");
    });
});

describe("sleep", () => {
    it("resolves after the requested delay", async () => {
        vi.useFakeTimers();
        let done = false;
        const p = sleep(1000).then(() => { done = true; });

        await vi.advanceTimersByTimeAsync(999);
        expect(done).toBe(false);

        await vi.advanceTimersByTimeAsync(1);
        await p;
        expect(done).toBe(true);
    });

    it("resolves with undefined", async () => {
        await expect(sleep(0)).resolves.toBeUndefined();
    });
});

describe("safeJsonParse", () => {
    it("parses valid json", () => {
        expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    });

    it("returns the fallback for malformed json", () => {
        expect(safeJsonParse("{oops", { a: 0 })).toEqual({ a: 0 });
    });

    it("returns the fallback for an empty string", () => {
        expect(safeJsonParse("", null)).toBeNull();
    });

    it("parses json primitives", () => {
        expect(safeJsonParse("42", 0)).toBe(42);
        expect(safeJsonParse("null", "x")).toBeNull();
    });

    it("never throws", () => {
        expect(() => safeJsonParse("undefined", [])).not.toThrow();
    });
});

describe("generateOrderNumber", () => {
    it("uses the ORD- prefix with two segments", () => {
        expect(generateOrderNumber()).toMatch(/^ORD-[0-9A-Z]+-[0-9A-Z]{1,4}$/);
    });

    it("is unique across a burst", () => {
        const seen = new Set(Array.from({ length: 100 }, () => generateOrderNumber()));
        // The timestamp segment only advances per millisecond, so uniqueness
        // within a burst rests entirely on the random suffix.
        expect(seen.size).toBeGreaterThan(90);
    });

    it("encodes the current time in the first segment", () => {
        vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));
        const expected = Date.now().toString(36).toUpperCase();
        expect(generateOrderNumber()).toContain(`ORD-${expected}-`);
    });
});
